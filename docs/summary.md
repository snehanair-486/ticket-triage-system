# Ticket Triage — Project Handoff Summary

This document describes a working serverless ticket-triage application so another engineer or AI agent can pick it up without prior context. Statements are marked **[confirmed]** when the owner saw them work or in a console, and **[not verified]** when they were assumed or never checked.

Secrets are intentionally not included. The Groq API key lives only in a Lambda environment variable.

---

## 1. What the application does

A user describes a problem in a web form. The system stores it, uses an LLM to rate its urgency and pick a team, and emails an alert for High urgency tickets. Staff can view and filter all tickets in a queue page.

Flow:

1. Browser (React) sends `POST /tickets` with `{"text": "..."}`.
2. API Gateway invokes Lambda `submitTicket`.
3. `submitTicket` writes the ticket to DynamoDB (`status: PENDING`) and sends a message to SQS (`ticket-queue`). It returns `{"ticketId": "..."}`.
4. SQS triggers Lambda `classifyTicket`.
5. `classifyTicket` calls the Groq API (LLM) to get urgency, team, summary and reason. If Groq fails it uses a keyword-rules fallback. It updates the DynamoDB item (`status: CLASSIFIED`).
6. If urgency is `High`, `classifyTicket` publishes to SNS topic `ticket-alerts`, which emails a subscriber.
7. The frontend polls `GET /tickets/{ticketId}` to show the result, and the staff queue polls `GET /tickets` every 5 seconds. Both are served by Lambda `getTickets`.

**Status: the whole flow works end to end [confirmed]** (submit, DynamoDB write, SQS, Groq classification, High urgency email received, list and single-ticket reads).

---

## 2. Team split

- Person A (owner of this summary): AWS backend, IAM, API Gateway, Lambda, testing.
- Person B: React frontend, pushed to the shared GitHub repo.

Decision made: all AWS work stays with Person A, because the Bedrock/account issues below are tied to Person A's AWS account and cannot be fixed from another account.

---

## 3. AWS services used

**Region: Asia Pacific (Sydney), `ap-southeast-2`** for everything [confirmed for API Gateway, Lambda, DynamoDB, SQS, SNS, CloudWatch consoles].

Account type: AWS **Free plan** with credits (about $119.99 remaining, 183 days left when checked). This is relevant to the Bedrock problem below.

| Service | Resource | Details |
|---|---|---|
| API Gateway (HTTP API) | `TicketManagementAPI` | Base URL `https://1jgh0qrgfg.execute-api.ap-southeast-2.amazonaws.com`. Routes below. |
| Lambda | `submitTicket` | Python 3.12, handler `app.lambda_handler`. Validates input, writes to DynamoDB, enqueues to SQS. |
| Lambda | `classifyTicket` | Python 3.12, handler `app.lambda_handler`, 128 MB memory, triggered by SQS. Calls Groq, updates DynamoDB, publishes SNS. Timeout should be 30 s. |
| Lambda | `getTickets` | Python 3.12. One function serves both read routes. |
| DynamoDB | table `Tickets` | Partition key `ticketId` (String), no sort key, on-demand capacity, standard class. |
| SQS | `ticket-queue` (standard) and `ticket-dlq` | `ticket-queue` triggers `classifyTicket`. |
| SNS | topic `ticket-alerts` | Email subscription confirmed (alert email received) [confirmed]. |
| IAM | role `PowerUserRole` | Execution role of `classifyTicket` [confirmed]. Policies: `PowerUserAccess`, `ClassifyTicketBedrockAccess` (now unused), inline `ClassifyTicketSNSPublish` (allows `sns:Publish` on the topic). |
| CloudWatch Logs | `/aws/lambda/<function>` | Used to debug; the log line `Groq failed, using fallback: ...` shows classification errors. |

**Routes on `TicketManagementAPI`** (in the console tree, `/{ticketId}` appears as a child of `/tickets`, so its full path is `/tickets/{ticketId}`):

- `POST /tickets` → `submitTicket`
- `GET /tickets` → `getTickets`
- `GET /tickets/{ticketId}` → `getTickets` [confirmed with a 200 response]

Not verified: the execution roles of `submitTicket` and `getTickets` (assumed to have DynamoDB and SQS access, and they work, so permissions are sufficient in practice), whether `ticket-dlq` is configured as the dead-letter queue of `ticket-queue`, and API-level CORS settings.

---

## 4. AI used

**Final choice: Groq API, model `openai/gpt-oss-20b`** [confirmed working].

- Called from `classifyTicket` using Python's built-in `urllib` (no extra packages), `POST https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible), with `temperature: 0` and `max_tokens: 1500`. The high token limit matters because this is a reasoning model that spends tokens thinking before answering.
- The prompt asks for a JSON object `{"urgency", "team", "summary", "reason"}`. The code extracts the first `{...}` from the reply and validates `urgency` and `team` against allowed lists.
- Auth: Lambda environment variable `GROQ_API_KEY`. Optional `GROQ_MODEL` overrides the model. A custom `User-Agent` header is set because the default Python one can be blocked.
- The Groq `/models` list for the owner's key contained text models `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` and a few non-chat models. `llama-3.3-70b-versatile` was **not** available to this key and returned HTTP 404.
- Data note: ticket text is sent to Groq. Use test data only.

**Fallback:** if the Groq call fails for any reason, `classify_with_keywords` assigns urgency and team using keyword rules, so the pipeline still completes. It sets `classifiedBy: "keyword-fallback"`. A successful LLM result sets `classifiedBy: "groq"`.

**Amazon Bedrock was tried and abandoned [confirmed]:**
- First error: `AccessDeniedException: Your account is currently being verified...`.
- Later, with `openai.gpt-6-sol`: `AccessDeniedException ... is not available for this account`. Several other models gave the same kind of message, and the region could not be changed in the playground.
- Conclusion (best explanation, not proven): an account-level restriction, possibly related to the Free plan. It was not an IAM or code problem. No support case was opened.

---

## 5. Data model (DynamoDB `Tickets`)

| Field | Type | Notes |
|---|---|---|
| `ticketId` | String (key) | UUID v4 generated in `submitTicket` |
| `text` | String | The user's description, trimmed, max 2000 characters |
| `status` | String | `PENDING` then `CLASSIFIED` |
| `createdAt` | String | UTC ISO 8601 timestamp |
| `urgency` | String | `High`, `Medium` or `Low` |
| `team` | String | `Finance`, `Tech`, `Account` or `General` (these match the frontend filter options) |
| `summary` | String | One sentence, at most 300 characters |
| `reason` | String | One sentence, at most 300 characters |
| `classifiedBy` | String | `groq` or `keyword-fallback` |

Early test tickets created before the final code may contain other team names (such as `access`) and may remain `PENDING`. The owner deleted test data before the demo.

---

## 6. API contract

**`POST /tickets`**
- Request: `Content-Type: application/json`, body `{"text": "..."}`.
- Success: `201` with `{"ticketId": "<uuid>"}`.
- `400` with `{"error": "..."}` for invalid JSON, missing or empty `text`, or text over 2000 characters.
- `500` with `{"error": "Could not save the ticket."}` if the DynamoDB write fails. If DynamoDB succeeds but SQS fails, it returns `500` with `{"error": "Ticket saved but not queued.", "ticketId": "..."}`.

**`GET /tickets`**
- `200` with `{"tickets": [ ... ]}`, newest first by `createdAt`. Uses a DynamoDB `Scan` with pagination, which is fine at demo scale but not for large tables.

**`GET /tickets/{ticketId}`**
- `200` with the ticket object, or `404` with `{"error": "Ticket not found."}`.

CORS: the Lambdas return `Access-Control-Allow-Origin: *` on their responses. The local frontend at `http://localhost:5173` works [confirmed]. Not verified: API Gateway's own CORS configuration, which should be reviewed if the frontend is hosted elsewhere.

There is no authentication or rate limiting on the API [confirmed by design].

---

## 7. Frontend (built by Person B)

- React with Vite (`npm run dev`, served at `http://localhost:5173/`). Files: `App.jsx`, `main.jsx`, `ReportPage.jsx`, `Dashboard.jsx`, `api.js`, `styles.css`.
- Hash routing: `#/` is the report page, `#/queue` is the staff queue.
- Report page: textarea (2000 characters max), calls `submitTicket(text)`, then polls for the classification and shows urgency, team, summary and reason.
- Staff queue: calls `listTickets()` every 5 seconds, shows counts and filters by urgency and team (options: High/Medium/Low/Analysing and Finance/Tech/Account/General).
- `api.js` reads `VITE_API_BASE` from the environment, falling back to the API base URL above. A previous bug had the fallback URL wrapped in Markdown link syntax (`[https://...](https://...)`), which made requests go to the Vite dev server instead of AWS. It was fixed.
- `frontend/.env.example` holds `VITE_API_BASE=<API URL>`. A local `frontend/.env` is a copy of it and is git-ignored. Never put the Groq key in any `VITE_` variable, because those are bundled into browser code.
- The frontend expects `POST /tickets` to return `ticketId` (or `id`), and looks up one ticket with `GET /tickets/{ticketId}`, falling back to scanning the full list if that fails.

---

## 8. Repository

- GitHub: `https://github.com/snehanair-486/ticket-management-system.git`, branch `main`. Local path: `C:\Users\sneha\Documents\ticket-triage` (Windows, PowerShell).
- Layout: `frontend/`, `lambda-submit/app.py`, `lambda-classify/app.py`, `lambda-get/app.py`, `tests/`, `README.md`, `.gitignore`.
- Two `.gitignore` files (root and `frontend/`). `frontend/.gitignore` ignores `.env` and explicitly keeps `.env.example` [confirmed with `git check-ignore -v`].
- The Lambda folders were empty locally at first, and the working code was developed in chat and pasted into the Lambda console. At the time of writing, **pushing the final Lambda code to GitHub was still pending**.

---

## 9. Issues found and how they were resolved (useful history)

1. **"The server did not return a ticket ID"**: `POST /tickets` returned `"Hello from Lambda!"` because `submitTicket` still contained AWS starter code (Node.js) and local files were empty. Fixed by writing Python code and deploying it to Lambda, setting runtime Python 3.12 and handler `app.lambda_handler`. Saving code locally does not change AWS.
2. **Malformed API URL in `api.js`** (Markdown link syntax): fixed.
3. **PowerShell curl quoting**: JSON bodies broke with inline quotes. Use a file with `--data "@body.json"` instead.
4. **Team names mismatch**: the classifier's team list had to match the frontend's filter options.
5. **Bedrock not available to the account**: replaced with Groq (section 4).
6. **Groq HTTP 404**: the first model name was not available to the key. Checked the model list with `curl https://api.groq.com/openai/v1/models` and switched to `openai/gpt-oss-20b`.
7. **Apparent route problem** (`GET /{ticketId}`): not a bug. It is a child of `/tickets` in the console tree, so the full path is correct.

---

## 10. Known limitations and suggested next steps

- Push final Lambda code to GitHub and fill in `README.md` and `tests/` (currently empty).
- Verify `ticket-dlq` is attached as the dead-letter queue of `ticket-queue`.
- Review API Gateway CORS before hosting the frontend elsewhere.
- No auth or throttling: anyone with the URL can submit tickets and use the Groq quota. Add API throttling or auth before any public use.
- IAM is broad (`PowerUserRole` with `PowerUserAccess`). For production, replace with least-privilege roles per function.
- `getTickets` uses a table `Scan`. Add a query index (for example on urgency or createdAt) if volume grows.
- The Groq key is stored as a Lambda environment variable, which is acceptable for a demo. Use AWS Secrets Manager for production.
- Medium and Low tickets do not trigger email, by design.