# Presentation Slides Outline & Live Demo Script

## Part A: Presentation Slides Outline (7-8 Slides)

### Slide 1: Title & Team
* **Title:** Smart Ticket Triage & Management System
* **Course:** BCSE355L - AWS Solutions Architect (Review 2)
* **Team Members:** Person A (Backend & Data Layer), Person B (Client & Edge Ingestion)
* **Core Value Proposition:** Decoupled, serverless customer support automation powered by Amazon Bedrock.

### Slide 2: The Problem & 3 Structural Gaps
* Customer support ticket volume is bursty and unpredictable.
* **Gap 1:** Synchronous AI inference causes request timeouts and crashes under load.
* **Gap 2:** Traditional servers (EC2) incur high idle running costs.
* **Gap 3:** Keyword routing fails to understand context and urgency accurately.

### Slide 3: Cloud Architecture (End-to-End Journey)
* Visual architecture walkthrough (Browser ? CloudFront ? API Gateway ? Lambdas ? DynamoDB & SQS ? Bedrock).
* Explain the separation of duties: Edge ingestion acknowledges immediately (HTTP 201/202), while Bedrock processes asynchronously in the background.

### Slide 4: Why Serverless & Asynchronous Ingestion?
* Eliminates cold wait times: Customer receives instant confirmation (`ticketId`).
* SQS absorbs sudden traffic surges without overwhelming downstream Bedrock quotas.
* True zero-cost idle operation.

### Slide 5: Service Justifications & Trade-offs
* **S3 + CloudFront vs EC2/Nginx:** Zero OS patching, global edge caching, automated SSL.
* **API Gateway vs Application Load Balancer (ALB):** Built-in rate throttling, stage management (`/prod`), native CORS handling.
* **AWS Lambda:** Automatic elastic scaling with sub-second execution billing.

### Slide 6: Security & Least-Privilege Design
* S3 Block Public Access + Origin Access Control (OAC).
* IAM `edge-lambda-role` restricted strictly to specific DynamoDB table and SQS queue ARNs.
* Strict input validation (empty and >2000 character boundaries rejected with HTTP 400).
* API Gateway token-bucket throttling (10 req/s, burst 20).

### Slide 7: Empirical Testing & Results
* **Functional Test Suite:** 100% pass rate across 8 positive and negative test cases.
* **Concurrency Load Test:** Multi-threaded execution showing resilient throughput and proper rate limit enforcement.
* **Cost Summary:** Measured test cycle cost < $0.05.

### Slide 8: Limitations & Roadmap
* Limitations: Table scans on large ticket volumes, public queue dashboard.
* Future Roadmap: Amazon Cognito authentication, AppSync GraphQL real-time push subscriptions, DynamoDB GSIs.

---

## Part B: Rehearsed Live Demo Script (3-Minute Walkthrough)

### Setup Before You Start
1. Have the app open in Chrome: `http://localhost:5173` (or your CloudFront distribution URL).
2. Open a second tab on the **Staff Queue** page (`http://localhost:5173/#/queue`).
3. Keep the AWS CloudWatch / DynamoDB console tab open in the background as proof.

### Demo Step 1: Submit a Critical Ticket (Urgent Priority Flow)
* **Action:** In the "What went wrong?" form, type:
  > *"My credit card was charged twice and the checkout crashed. I need an immediate refund!"*
* **Speech:** *"Notice that when I click 'Send ticket', the edge Lambda acknowledges the request in under 300 milliseconds with an HTTP 201/202 and ticket ID, so the user never experiences a frozen screen."*
* **Result:** Show the UI display: **High priority**, assigned to **General/Finance**, with an AI-generated explanation.

### Demo Step 2: Live Staff Queue Updating
* **Action:** Switch to the **Staff Queue** tab.
* **Speech:** *"The staff queue automatically updates every 5 seconds. Our high-priority ticket immediately appears at the very top of the queue."*
* **Action:** Click the ticket to expand it, showing the ticket ID, timestamps, and routing details.
* **Action:** Filter by dropdown (*Urgency: High*), showing reactive sorting.

### Demo Step 3: Input Validation & Boundary Checks
* **Action:** Try submitting an empty text box.
* **Speech:** *"Our edge API enforces strict input validation. Empty submissions and payloads exceeding 2,000 characters are intercepted and rejected with HTTP 400 before ever touching the database or invoking AI models."*

### Backup Plan
* If live Wi-Fi or API Gateway encounters a temporary network delay, switch to the screenshots in `docs/` and run the local test suite:
  ```bash
  python tests/test.py
  ```
  to prove the entire API pipeline passes live.
