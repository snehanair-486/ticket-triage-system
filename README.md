# Smart AI Ticket Triage System

A serverless incident management and support triage platform powered by AWS cloud infrastructure and Groq AI. The system automatically ingests user support tickets, performs real-time classification of incident urgency and department routing via an LLM reasoning engine, sends automated notifications for critical outages, and provides dedicated portals for customers and internal support engineers.

---

## Architecture Overview

The system uses an asynchronous, decoupled serverless architecture on AWS:

```
[ Customer / Staff Browser ]
           │
           ▼
[ AWS API Gateway (HTTP API) ]
           │
           ├───────────────────────────────┐
    (POST /tickets)                  (GET /tickets, /tickets/{id})
           │                               │
           ▼                               ▼
 [ Lambda: submitTicket ]         [ Lambda: getTickets ]
      │           │                        │
      │ (Write)   │ (Enqueue)              │ (Read)
      ▼           ▼                        ▼
 [ DynamoDB ]   [ SQS: ticket-queue ]  [ DynamoDB (Tickets) ]
      ▲                   │
      │ (Update)          ▼
      └───────── [ Lambda: classifyTicket ]
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
     [ Groq LLM API ]          [ SNS: ticket-alerts ]
(Urgency, Team, Reasoning)      (Email on High Urgency)
```

### End-to-End Workflow:
1. **Intake**: A customer submits an incident description via the React frontend to `POST /tickets`.
2. **Persistence & Queueing**: The `submitTicket` Lambda validates input, writes a `PENDING` record to Amazon DynamoDB, and dispatches the payload to an Amazon SQS queue.
3. **AI Classification**: Amazon SQS triggers `classifyTicket`, which prompts the Groq LLM (`openai/gpt-oss-20b`) to determine urgency (`High`, `Medium`, `Low`), department assignment (`Tech`, `Finance`, `Account`, `General`), ticket summary, and justification. A keyword-based heuristic fallback is executed if the AI endpoint is unreachable.
4. **Alerts**: If urgency is evaluated as `High`, an alert is published to an Amazon SNS topic, notifying on-call personnel via email.
5. **Queue & Inspection**: The ticket is updated to `CLASSIFIED` in DynamoDB. Customers and staff monitor live ticket progression via `GET /tickets` and `GET /tickets/{ticketId}`.

---

## Features

- **Side-by-Side Portal Selection**: Direct choice between Customer Service Desk and Staff Operations Command Center on application load.
- **Customer Portal**:
  - Instant ticket submission with pre-configured issue templates.
  - User-specific ticket history (each customer only sees their own submitted tickets).
  - Real-time tracking of AI classification and agent resolution status.
  - Flexible customer authentication (Sign In and Create Account).
- **Staff Operations Command Center**:
  - Live incident stream synchronized with Amazon DynamoDB.
  - Multi-attribute filtering by urgency, assigned department, and search keywords.
  - Grouping and aggregation of identical duplicate incident reports.
  - Direct incident status management (`In Progress`, `Resolved`) reflecting immediately on customer tickets.
  - Authenticated staff access with role-based identity management.
- **Automated AI Triage**: Fast LLM reasoning pipeline with deterministic JSON schema extraction and reliable fallback rules.
- **Unified Dark Mode**: Professional, non-flashy dark theme with clean SVG icons across all interfaces.

---

## Tech Stack

- **Frontend**: React 18, Vite, Vanilla CSS design system.
- **Compute**: AWS Lambda (Python 3.12).
- **API Management**: Amazon API Gateway (HTTP API).
- **Database**: Amazon DynamoDB (On-Demand capacity).
- **Messaging & Queues**: Amazon SQS (Standard queue & DLQ).
- **Notifications**: Amazon SNS (Email subscription topic).
- **AI / LLM Engine**: Groq API (`openai/gpt-oss-20b` reasoning model).
- **Monitoring**: Amazon CloudWatch Logs.

---

## Project Structure

```
ticket-triage/
├── frontend/                   # React + Vite frontend application
│   ├── src/
│   │   ├── App.jsx             # Top-level portal routing & layout
│   │   ├── PortalSelect.jsx    # Side-by-side portal landing view
│   │   ├── CustomerPortal.jsx  # Customer ticket submission & user history
│   │   ├── CustomerLogin.jsx   # Customer authentication (login / signup)
│   │   ├── CustomerAuthModal.jsx# Auth modal for customer portal
│   │   ├── StaffPortal.jsx     # Staff command center queue & resolution controls
│   │   ├── StaffLogin.jsx      # Internal staff authentication
│   │   ├── auth.js             # RBAC, customer registration, session management
│   │   ├── api.js              # API Gateway client & local synchronization
│   │   ├── Icons.jsx           # Clean SVG icon components (zero emojis)
│   │   ├── styles.css          # Standard dark theme stylesheet
│   │   └── main.jsx            # React root entry point
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
├── lambda-submit/              # Ticket ingestion Lambda function
│   └── app.py                  # Validates input, writes to DynamoDB, enqueues to SQS
├── lambda-classify/            # Ticket classification Lambda function
│   └── app.py                  # Consumes SQS, runs Groq AI triage, updates DynamoDB, alerts SNS
├── lambda-get/                 # Read endpoint Lambda function
│   └── app.py                  # Serves GET /tickets and GET /tickets/{ticketId}
├── tests/                      # Testing & load verification scripts
│   ├── test.py                 # End-to-end integration test
│   ├── test_submit.py          # Submission validation test
│   └── load.py                 # Concurrency / load test script
├── docs/                       # Project documentation & handoff notes
│   ├── architecture.md         # Architecture diagrams & component breakdown
│   └── summary.md              # Detailed project summary (AWS, backend, frontend)
└── README.md
```

---

## Local Setup

### Prerequisites
- Node.js (v18+) and npm
- Python (v3.10+)

### 1. Frontend Setup
Navigate to the `frontend` directory, install dependencies, and launch the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

The application will start locally at `http://localhost:5173/`.

### 2. Environment Configuration
The frontend automatically points to the live AWS API Gateway endpoint by default. To override it with a custom gateway URL:

1. Copy `.env.example` to `.env` in the `frontend` directory:
   ```bash
   cp .env.example .env
   ```
2. Set your API Gateway endpoint:
   ```env
   VITE_API_BASE=https://<your-api-id>.execute-api.ap-southeast-2.amazonaws.com
   ```

### 3. Production Build
To create an optimized production bundle:

```bash
npm run build
```

Production artifacts are output to `frontend/dist/`.

### 4. Running Backend Tests
To test the API Gateway and backend pipeline:

```bash
python tests/test.py
```
