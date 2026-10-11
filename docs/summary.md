# Ticket Triage System — Comprehensive Project Summary

This document provides a complete technical summary of the serverless ticket triage platform, detailing the AWS cloud services, backend Lambda functions, AI classification pipeline, and the frontend architecture.

---

## 1. Executive Overview

The Smart AI Ticket Triage System is an enterprise-grade, serverless cloud application designed to automate the intake, classification, and routing of customer support requests.

When an incident is reported, the system:
1. Immediately accepts and stores the ticket in **Amazon DynamoDB** with status `PENDING`.
2. Decouples heavy AI processing via **Amazon SQS** to ensure high availability and sub-second API response times.
3. Automatically classifies urgency and department routing using a fast **Groq LLM reasoning engine** (`openai/gpt-oss-20b`), backed by a deterministic heuristic keyword engine.
4. Dispatches immediate incident notifications via **Amazon SNS** email alerts for `High` urgency tickets.
5. Provides a unified, professional **React + Vite** frontend with separate interfaces for customers and internal support engineers.

**Operational Status:** The complete pipeline is operational and tested end-to-end against AWS region `ap-southeast-2` (Sydney).

---

## 2. AWS Cloud Infrastructure Deep-Dive

All cloud resources are provisioned in **Asia Pacific (Sydney) — `ap-southeast-2`**.

### Summary Matrix

| AWS Service | Resource Identifier | Role & Functionality |
|---|---|---|
| **API Gateway (HTTP API)** | `TicketManagementAPI` | Public entry point (`https://1jgh0qrgfg.execute-api.ap-southeast-2.amazonaws.com`). Routes requests to Lambda functions. |
| **AWS Lambda** | `submitTicket` | Ingestion handler: validates input, writes `PENDING` record to DynamoDB, enqueues to SQS. |
| **AWS Lambda** | `classifyTicket` | Background processor: triggered by SQS, calls Groq AI / fallback rules, updates DynamoDB, publishes SNS alert. |
| **AWS Lambda** | `getTickets` | Read handler: serves both full ticket lists and single-ticket detail lookups. |
| **Amazon DynamoDB** | Table `Tickets` | Primary persistence layer: NoSQL table with on-demand capacity and `ticketId` partition key. |
| **Amazon SQS** | `ticket-queue` & `ticket-dlq` | Asynchronous message buffer decoupling intake from AI classification. Dead-letter queue captures failed messages. |
| **Amazon SNS** | Topic `ticket-alerts` | Pub/sub notification service with email subscription for high-urgency incidents. |
| **Amazon CloudWatch** | `/aws/lambda/*` | Real-time logging, execution metrics, and error tracing. |
| **AWS IAM** | Execution Roles | Granular security policies granting least-privilege resource access. |

---

### Detailed Service Configurations

#### 1. Amazon API Gateway (HTTP API v2)
- **Base Endpoint**: `https://1jgh0qrgfg.execute-api.ap-southeast-2.amazonaws.com`
- **Configured Routes**:
  - `POST /tickets`: Invokes `submitTicket`. Ingests customer ticket text. Returns `201 Created` with `{"ticketId": "<uuid>"}`.
  - `GET /tickets`: Invokes `getTickets`. Returns all tickets sorted newest-first for the staff queue.
  - `GET /tickets/{ticketId}`: Invokes `getTickets`. Retrieves single ticket status and classification details.
- **CORS Configuration**: All Lambda handlers attach `Access-Control-Allow-Origin: *` headers, allowing seamless cross-origin requests from both local development (`http://localhost:5173`) and hosted environments.

#### 2. Amazon DynamoDB
- **Table Name**: `Tickets`
- **Primary Key**: `ticketId` (String / UUID v4). No sort key.
- **Billing Mode**: On-Demand (PAY_PER_REQUEST) — scales automatically with zero idle cost.
- **Item Schema**:
  ```json
  {
    "ticketId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "text": "Checkout payment fails with error code 500.",
    "status": "CLASSIFIED",
    "createdAt": "2026-10-11T12:00:00.000Z",
    "urgency": "High",
    "team": "Finance",
    "summary": "Customer unable to complete checkout due to payment error 500.",
    "reason": "Payment failure blocks revenue and transaction completion.",
    "classifiedBy": "groq"
  }
  ```
- **Lifecycle Progression**: Tickets enter with `status: "PENDING"`, transition to `status: "CLASSIFIED"` once processed by the AI worker, and can be updated to `status: "IN PROGRESS"` or `status: "RESOLVED"` by staff agents.

#### 3. Amazon Simple Queue Service (SQS)
- **Primary Queue**: `ticket-queue` (Standard Queue).
- **Dead-Letter Queue (DLQ)**: `ticket-dlq` (catches repeatedly failing messages to avoid blocking).
- **Trigger**: SQS event source mapping configured to trigger `classifyTicket` in batches (`batchSize: 1` to `10`).
- **Architectural Value**: Guarantees that surges in customer ticket submissions never throttle the web API or overload external AI rate limits.

#### 4. Amazon Simple Notification Service (SNS)
- **Topic ARN**: `arn:aws:sns:ap-southeast-2:103021623836:ticket-alerts`
- **Subscribers**: Verified email endpoint.
- **Trigger Condition**: Evaluated inside `classifyTicket`. Whenever `urgency == "High"`, a formatted notification is published with subject `"High urgency ticket"`, delivering the summary, team routing, reason, and customer excerpt directly to support on-call personnel.

#### 5. Amazon CloudWatch Logs
- Functions log request execution, DynamoDB latency, Groq API responses, and fallback events to `/aws/lambda/<function_name>`.

---

## 3. Backend & AI Classification Pipeline

The backend codebase is written in **Python 3.12** using `boto3`.

### Lambda Function Breakdown

#### A. `lambda-submit` (`lambda-submit/app.py`)
- **Handler**: `app.lambda_handler`
- **Execution Flow**:
  1. Decodes incoming payload (handles UTF-8 and base64 encoding).
  2. Validates JSON structure and enforces a maximum text length of 2,000 characters.
  3. Generates a unique UUID v4 `ticketId` and UTC timestamp.
  4. Writes initial record to DynamoDB with `status: PENDING`.
  5. Sends message `{"ticketId": ticket_id, "text": text}` to SQS `ticket-queue`.
  6. Returns `201 Created` with the `ticketId`.

#### B. `lambda-classify` (`lambda-classify/app.py`)
- **Handler**: `app.lambda_handler`
- **Execution Flow**:
  1. Consumes records from the SQS event.
  2. Invokes `classify_with_groq(text)`:
     - Issues an HTTPS `POST` request to `https://api.groq.com/openai/v1/chat/completions` using Python's native `urllib` (no external runtime dependencies).
     - Selected Model: `openai/gpt-oss-20b` (reasoning model with 1,500 token ceiling and temperature `0`).
     - Extracts structured JSON: `urgency` (`High`, `Medium`, `Low`), `team` (`Finance`, `Tech`, `Account`, `General`), `summary`, and `reason`.
  3. **Heuristic Keyword Fallback (`classify_with_keywords`)**:
     - If the Groq API is unavailable, returns non-200, or encounters network limits, the pipeline automatically executes a local regex/keyword rules engine.
     - Flags `classifiedBy: "keyword-fallback"`, guaranteeing zero lost tickets or pipeline crashes.
  4. Updates the DynamoDB item with `status: CLASSIFIED` and classification metadata.
  5. If urgency is `High`, publishes an alert to Amazon SNS.

#### C. `lambda-get` (`lambda-get/app.py`)
- **Handler**: `app.lambda_handler`
- **Execution Flow**:
  1. Checks `event.pathParameters.ticketId`.
  2. If `ticketId` is present: executes `table.get_item` and returns the single ticket object (`200`) or `404 Not Found`.
  3. If `ticketId` is absent: executes paginated `table.scan()`, sorts records newest-first by `createdAt`, and returns `{"tickets": [...]}`.

---

## 4. Frontend Architecture & User Experience

The frontend is built with **React 18** and **Vite**, styled using a bespoke vanilla CSS design system.

### Visual Aesthetic & Theme System
- **Standard Dark Theme**: Unified, non-flashy dark mode across the entire application using deep charcoal/slate tones (`#0b0f17`, `#111827`, `#1a2234`) with crisp borders (`#223049`) and clean typography.
- **Zero Emojis Policy**: Replaced all emojis throughout the application with scalable, accessible SVG icons defined in `Icons.jsx`.

### Key Frontend Views & Capabilities

#### 1. Landing View (`PortalSelect.jsx`)
- As soon as the application loads (route `#/`), users are presented with two side-by-side cards:
  - **Customer Portal**: Public service desk card with action buttons for Sign In, Create Account, or continuing active customer sessions.
  - **Staff Operations Portal**: Internal command center card with authorized staff login.
- Displays active authenticated identity chips and navigation buttons to switch between portals at any time.

#### 2. Customer Service Desk (`CustomerPortal.jsx`)
- **User-Isolated Ticket History**: Each customer account only sees tickets they submitted. Ticket IDs are mapped locally to `user.email` (`triage_user_tickets_<email>`). New accounts start with zero tickets and no cross-account data leakage.
- **Live Ticket Submission**: Text input with character counter (max 2,000 characters) and quick templates (*Checkout Failed*, *Application Crashing*, *Account Access Issue*, *General Inquiry*).
- **Progress Tracking & AI Rationale**: Live polling of classification results with a 4-step progress timeline:
  1. Logged in DynamoDB
  2. AI Triage & Urgency
  3. Dispatched to Department
  4. Agent Resolution
- **Live Staff Resolution Reflection**: The customer portal listens to resolution updates (`storage` and `triage_status_updated` events) and highlights when staff marks an issue as `Resolved` with green badges, status banners, and step-4 timeline completion.

#### 3. Customer Authentication (`CustomerLogin.jsx` & `CustomerAuthModal.jsx`)
- Clean interface allowing customers to toggle between **Sign In** and **Create Account**.
- No hardcoded demo credentials. Dynamic registration saves accounts securely in browser storage (`triage_registered_customers`) with validation.

#### 4. Staff Operations Command Center (`StaffPortal.jsx`)
- **Internal Authentication (`StaffLogin.jsx`)**:
  - Configured with 3 staff accounts defined exclusively in code (`auth.js`):
    - `staff1` (Password: `staff1@123`) — Tier 1 Support Specialist
    - `staff2` (Password: `staff2@123`) — Tier 2 Incident Lead
    - `staff3` (Password: `staff3@123`) — Operations Administrator
  - Credentials and autofill directories are completely hidden from the website UI.
  - Security lockout active after 5 failed attempts with countdown timer.
- **Incident Queue & Analytics**:
  - Auto-refreshes every 5 seconds against DynamoDB.
  - Analytics cards showing total volume, high urgency percentage, medium priority, and routine tickets.
  - Urgency distribution visual bar.
  - Multi-attribute toolbar: keyword search, urgency filter, department filter, and raw vs grouped view.
  - Duplicate complaint aggregation: combines identical customer statements to highlight widespread outages.
  - Interactive ticket inspector: customer quote, AI classification rationale, urgency severity score, customer sentiment indicator, and direct incident actions (`In Progress`, `Resolved`).

---

## 5. Security & Identity Management (`auth.js`)

- **Role-Based Access Control (RBAC)**: Enforces clear separation between `customer` and `staff` roles.
- **Session Tokens**: Generates session tokens with 8-hour expiry stored in `localStorage` or `sessionStorage`.
- **Security Audit Logging**: Records login attempts, clearances, and sign-outs into an internal security audit log (`triage_security_audit_log`).
- **Terminal Lockout**: Automatically locks staff authentication for 30 seconds after 5 failed password attempts.

---

## 6. Testing & Operational Verification

### Automated Integration Test (`tests/test.py`)
- Sends a test ticket to `POST /tickets`.
- Verifies `201 Created` and receives `ticketId`.
- Polls `GET /tickets/{ticketId}` until `status` transitions to `CLASSIFIED`.
- Verifies that `urgency`, `team`, and `summary` are populated by the AI engine.

### Concurrency / Load Testing (`tests/load.py`)
- Emulates multiple concurrent ticket submissions to verify DynamoDB write capacity, SQS queueing resilience, and API Gateway concurrency handling.

### Frontend Production Build
- Bundled and validated via `npm run build`:
  - 40 modules transformed with zero syntax or compilation errors.
  - Optimized output in `frontend/dist/`.