import json
import os
import re
import urllib.error
import urllib.request

import boto3

TABLE_NAME = os.environ.get("TABLE_NAME", "Tickets")
TOPIC_ARN = os.environ.get(
    "TOPIC_ARN", "arn:aws:sns:ap-southeast-2:103021623836:ticket-alerts"
)
# Set GROQ_API_KEY in the Lambda environment variables (never in this file).
# GROQ_MODEL is optional; change it if Groq retires this model.
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# CHANGE THESE if the frontend filters use different values.
URGENCY_LEVELS = ["High", "Medium", "Low"]
TEAMS = ["Finance", "Tech", "Account", "General"]

table = boto3.resource("dynamodb").Table(TABLE_NAME)
sns = boto3.client("sns")

PROMPT = """You triage support tickets. Read the ticket and reply with ONLY a JSON object, no other text:
{{"urgency": one of {urgency}, "team": one of {teams}, "summary": "one short sentence", "reason": "one short sentence explaining the urgency"}}

Ticket:
{text}"""


def classify_with_groq(text):
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY environment variable is not set")
    prompt = PROMPT.format(urgency=URGENCY_LEVELS, teams=TEAMS, text=text)
    payload = json.dumps(
        {
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            # Reasoning models spend tokens "thinking" before they answer,
            # so leave plenty of room or the reply can come back empty.
            "max_tokens": 1500,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        GROQ_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": "Bearer " + GROQ_API_KEY,
            "Content-Type": "application/json",
            # Without a User-Agent, Python's default one is sometimes blocked.
            "User-Agent": "ticket-triage-lambda/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Include Groq's own error message so the logs say what went wrong.
        detail = e.read().decode("utf-8", "replace")[:300]
        raise ValueError(f"Groq HTTP {e.code} using model {GROQ_MODEL}: {detail}")
    out = resp["choices"][0]["message"]["content"] or ""
    match = re.search(r"\{.*\}", out, re.DOTALL)
    if not match:
        raise ValueError("Model did not return JSON: " + out[:200])
    data = json.loads(match.group(0))

    urgency = next(
        (u for u in URGENCY_LEVELS if u.lower() == str(data.get("urgency", "")).lower()),
        None,
    )
    team = next(
        (t for t in TEAMS if t.lower() == str(data.get("team", "")).lower()), None
    )
    if not urgency or not team:
        raise ValueError("Model returned unexpected values: " + str(data))
    return {
        "urgency": urgency,
        "team": team,
        "summary": str(data.get("summary", ""))[:300],
        "reason": str(data.get("reason", ""))[:300],
        "classifiedBy": "groq",
    }


def classify_with_keywords(text):
    """Simple fallback so the pipeline still works if Bedrock is unavailable."""
    t = text.lower()
    high_words = ["down", "outage", "urgent", "critical", "cannot work",
                  "can't work", "data loss", "breach", "hacked", "production"]
    low_words = ["question", "how do i", "feature request", "minor", "when you can"]
    if any(w in t for w in high_words):
        urgency = "High"
    elif any(w in t for w in low_words):
        urgency = "Low"
    else:
        urgency = "Medium"

    if any(w in t for w in ["pay", "payment", "refund", "invoice", "charge",
                            "billing", "money", "cash", "transaction"]):
        team = "Finance"
    elif any(w in t for w in ["password", "login", "log in", "account", "locked",
                              "sign in", "profile", "access"]):
        team = "Account"
    elif any(w in t for w in ["wifi", "network", "vpn", "internet", "server",
                              "app", "software", "install", "error", "crash",
                              "bug", "laptop", "printer"]):
        team = "Tech"
    else:
        team = "General"

    return {
        "urgency": urgency,
        "team": team,
        "summary": text[:120],
        "reason": "Classified by keyword rules (AI model unavailable).",
        "classifiedBy": "keyword-fallback",
    }


def process(record):
    body = json.loads(record["body"])
    ticket_id = body["ticketId"]
    text = body.get("text", "")

    try:
        result = classify_with_groq(text)
    except Exception as e:
        print("Groq failed, using fallback:", repr(e))
        result = classify_with_keywords(text)

    # If this fails the exception propagates and SQS retries the message.
    table.update_item(
        Key={"ticketId": ticket_id},
        UpdateExpression=(
            "SET #s = :s, urgency = :u, team = :t, summary = :sm, "
            "reason = :r, classifiedBy = :cb"
        ),
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": "CLASSIFIED",
            ":u": result["urgency"],
            ":t": result["team"],
            ":sm": result["summary"],
            ":r": result["reason"],
            ":cb": result["classifiedBy"],
        },
    )
    print("Classified", ticket_id, result)

    if result["urgency"] == "High":
        try:
            sns.publish(
                TopicArn=TOPIC_ARN,
                Subject="High urgency ticket"[:100],
                Message=(
                    f"Ticket {ticket_id}\n"
                    f"Team: {result['team']}\n"
                    f"Summary: {result['summary']}\n"
                    f"Reason: {result['reason']}\n\n"
                    f"Text: {text[:500]}"
                ),
            )
        except Exception as e:
            # Don't retry the whole ticket just because the email failed.
            print("SNS publish failed:", repr(e))


def lambda_handler(event, context):
    for record in event.get("Records", []):
        process(record)
    return {"ok": True}