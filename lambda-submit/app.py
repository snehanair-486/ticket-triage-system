import base64
import json
import os
import uuid
from datetime import datetime, timezone

import boto3

TABLE_NAME = os.environ.get("TABLE_NAME", "Tickets")
QUEUE_NAME = os.environ.get("QUEUE_NAME", "ticket-queue")
MAX_LEN = 2000

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)
sqs = boto3.client("sqs")

_queue_url = os.environ.get("QUEUE_URL")


def get_queue_url():
    global _queue_url
    if not _queue_url:
        _queue_url = sqs.get_queue_url(QueueName=QUEUE_NAME)["QueueUrl"]
    return _queue_url


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    # Parse the body (HTTP API sends it as a string, sometimes base64 encoded)
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return respond(400, {"error": "Body must be valid JSON."})

    text = data.get("text") if isinstance(data, dict) else None
    if not isinstance(text, str) or not text.strip():
        return respond(400, {"error": "Field 'text' is required."})
    text = text.strip()
    if len(text) > MAX_LEN:
        return respond(400, {"error": f"Text must be {MAX_LEN} characters or fewer."})

    ticket_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    try:
        table.put_item(
            Item={
                "ticketId": ticket_id,
                "text": text,
                "status": "PENDING",
                "createdAt": created_at,
            }
        )
    except Exception as e:
        print("DynamoDB error:", repr(e))
        return respond(500, {"error": "Could not save the ticket."})

    try:
        sqs.send_message(
            QueueUrl=get_queue_url(),
            MessageBody=json.dumps({"ticketId": ticket_id, "text": text}),
        )
    except Exception as e:
        print("SQS error:", repr(e))
        # Ticket is saved, but classification was not queued.
        return respond(500, {"error": "Ticket saved but not queued.", "ticketId": ticket_id})

    return respond(201, {"ticketId": ticket_id})