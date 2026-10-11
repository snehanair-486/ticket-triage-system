# BCSE355L - Review 2 Project Report: Edge Ingestion & Client Architecture
**Course:** BCSE355L - AWS Solutions Architect  
**Project:** Smart Ticket Management & AI Triage System  
**Role Scope:** Client Layer, Edge Ingestion API, Security, and Testing (Person B)

---

## 1. Problem Statement & Identified Gaps

Traditional customer support systems struggle under irregular and bursty ticket volumes. Existing legacy architectures suffer from three critical structural gaps:

1. **Processing Bottleneck (Synchronous AI Latency):** Directly coupling ticket submission to heavy LLM inference causes HTTP timeouts, high server thread consumption, and poor user experience when traffic spikes.
2. **Infrastructure Overhead & Idle Costs:** Traditional compute models (EC2, VM clusters) must be provisioned for peak load, resulting in unnecessary ongoing costs during idle hours.
3. **Fragile Department Routing:** Rule-based routing engines fail to interpret semantic context, nuances, or multilingual customer complaints, requiring extensive manual human sorting.

---

## 2. Solution Overview & End-to-End Architecture

The proposed solution implements a cloud-native, decoupled serverless architecture on AWS:
* **Presentation Tier:** Static React/HTML SPA delivered globally via **Amazon CloudFront** and backed by a private **Amazon S3** origin.
* **Edge Ingestion Tier (Our Focus):** **Amazon API Gateway** (REST API) integrated with AWS Lambda (`submitTicket` and `getTickets`), providing sub-second acknowledgment (HTTP 201/202) and client polling.
* **Asynchronous Buffer Tier:** **Amazon SQS** decouples ticket intake from classification to smooth bursty traffic spikes.
* **Intelligence & Persistence Tier:** **AWS Lambda** (`classifyTicket`) invokes **Amazon Bedrock** (Claude 3 Haiku) for sentiment/urgency evaluation and updates **Amazon DynamoDB**.

---

## 3. Layer 1: Client Delivery (Amazon S3 + CloudFront)

### Design & Operation
The client frontend is bundled and deployed to an Amazon S3 bucket configured with **Block Public Access enabled**. Global delivery and HTTPS encryption are managed by an Amazon CloudFront distribution using **Origin Access Control (OAC)**.

### Alternatives Considered & Rejected
* **Amazon EC2 with Nginx:** Rejected due to operational complexity, OS patching requirements, server provisioning delays, and minimum hourly instance costs.
* **AWS Elastic Beanstalk:** Rejected because managing container orchestration or VM environments for purely static Single Page Applications (SPA) incurs unnecessary compute overhead and slower deployment cycles compared to edge CDN caching.

---

## 4. Layer 2: API Gateway & Edge Lambdas

### Endpoints and Contract
* `POST /tickets`: Accepts JSON payload `{"text": "..."}`. Returns `{"ticketId": "...", "status": "PENDING"}` with HTTP 201/202.
* `GET /tickets`: Returns collection of tickets sorted by urgency (`HIGH` first) and creation timestamp.
* `GET /tickets/{id}`: Returns single ticket object including AI-assigned `urgency`, `team`, and `summary`.

### Ingestion Design Highlights
* **201/202 Accepted Pattern:** Rather than blocking the browser while Amazon Bedrock evaluates the complaint (which takes 2�4 seconds), `submitTicket` stores the initial record in DynamoDB, enqueues an SQS message, and responds immediately. The frontend polls `GET /tickets/{id}` until status becomes `CLASSIFIED`.
* **API Gateway Throttling:** Configured at **10 requests/sec steady rate** with **burst capacity of 20 requests** to protect backend resources from denial-of-service and uncontrolled AI invocation costs.
* **CORS Compliance:** Configured with headers `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET,POST,OPTIONS`, and `Access-Control-Allow-Headers: Content-Type`.

---

## 5. AWS Service Selection Justification

| Service | Role | Key Justification |
| :--- | :--- | :--- |
| **Amazon S3 + CloudFront** | Client Hosting & CDN | Low-latency edge caching, TLS 1.3 termination, zero server maintenance, high availability (99.99%). |
| **Amazon API Gateway** | API Management | Native request validation, stage management (`/prod`), built-in throttling, and seamless Lambda proxy integration. |
| **AWS Lambda** | Edge Compute | True pay-per-use billing, automatic scale-out up to thousands of concurrent requests, no idle cost. |

---

## 6. Security, Availability, and Resilience

* **Zero Public S3 Access:** All public access blocked; S3 bucket policy strictly permits only CloudFront via `AWS:SourceArn` Condition.
* **Least-Privilege IAM Execution Role (`edge-lambda-role`):** Limited strictly to `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:Scan` on the `Tickets` table and `sqs:SendMessage` on the queue.
* **Input Validation & Sanitization:**
  * Enforces maximum character boundary (max 2000 characters).
  * Rejects empty text bodies and invalid JSON payloads with HTTP 400.
  * XSS prevention through React JSX context escaping (HTML tags like `<b>` render safely as text literals).
* **Traffic Shaping:** API Gateway token-bucket rate limiter prevents upstream exhaustion.

---

## 7. Testing & Evaluation

### Functional Test Suite (`tests/test.py`)

| Test Case | Input | Expected Status | Measured Status | Result |
| :--- | :--- | :---: | :---: | :---: |
| Critical Complaint | "My checkout is broken and I have been trying for an hour..." | 201/202 | 201 | **PASS** |
| System Outage | "The app crashes every time I log in, this is unacceptable" | 201/202 | 201 | **PASS** |
| General Inquiry | "How do I change my email address?" | 201/202 | 201 | **PASS** |
| Positive Feedback | "Thanks, the refund arrived quickly!" | 201/202 | 201 | **PASS** |
| Empty Submission | `{"text": ""}` | 400 | 400 | **PASS** |
| Buffer Overflow | Text exceeding 3,000 characters | 400 | 400 | **PASS** |
| Malformed JSON | Raw string payload `"not json"` | 400 | 400 | **PASS** |
| Non-existent Ticket | `GET /tickets/does-not-exist` | 404 | 404 | **PASS** |

### Concurrent Load Testing (`tests/load.py`)
* **Test Load:** 20 concurrent requests dispatched via multi-threaded workers.
* **Observed Throughput:** 5.6 requests/second; total execution time 3.55 seconds.
* **Throttle Validation:** 18 requests succeeded (201 Created); 2 requests intercepted by rate throttling/backoff, validating the effectiveness of API Gateway token-bucket limits.

---

## 8. Cost Analysis (Estimated & Measured)

Under standard academic review and low-to-moderate enterprise testing:
* **Amazon S3:** ~5 MB storage (< $0.01/month).
* **Amazon CloudFront:** Free tier covers 1 TB data transfer and 10,000,000 HTTPS requests.
* **Amazon API Gateway:** $3.50 per million calls (~$0.01 for 3,000 test requests).
* **AWS Lambda:** 1,000,000 free requests/month; compute duration for ~30ms invocations falls completely inside AWS Free Tier.
* **Total Incurred Cost:** **< $0.05 USD** across the entire testing cycle.

---

## 9. Architectural Limitations

1. **Dashboard Query Scalability:** Current dashboard uses `dynamodb:Scan` (with limit 100). As ticket volume exceeds tens of thousands of items, table scans become inefficient.
2. **Public Dashboard Accessibility:** The current queue is publicly viewable without enterprise Single Sign-On (SSO).
3. **Client Polling Overhead:** The client polls every 2 seconds for triage updates rather than receiving pushed events.

---

## 10. Future Work & Enhancements

1. **Enterprise Identity:** Integrate **Amazon Cognito** user pools to enforce role-based access control (RBAC) for staff agents.
2. **Real-time Push Updates:** Replace HTTP polling with **AWS AppSync (GraphQL Subscriptions)** or **API Gateway WebSocket APIs**.
3. **Query Optimization:** Introduce a Global Secondary Index (GSI) partitioned by `urgency` and sorted by `createdAt` to eliminate full table scans.