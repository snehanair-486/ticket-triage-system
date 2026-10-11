# Ticket Management System

Serverless ticket management and triage platform built with AWS Lambda and a React + Vite frontend.

## Project Structure

- rontend/ - React frontend with Vite for ticket submission and staff triage queue
- lambda-submit/ - Lambda handler to receive and queue new customer tickets
- lambda-classify/ - Lambda handler to classify ticket urgency and route to teams
- lambda-get/ - Lambda handler to retrieve ticket details and queue status
- 	ests/ - Backend unit and integration test suite

## Frontend Quickstart

1. Navigate to the frontend directory:
   ``bash
   cd frontend
   ``

2. Install dependencies:
   ``bash
   npm install
   ``

3. Start development server:
   ``bash
   npm run dev
   ``
   The app will run locally at http://localhost:5173/.

4. Build for production (S3 / CloudFront deployment):
   ``bash
   npm run build
   ``
   Build output will be generated in rontend/dist/.

## Configuration

Optionally configure the API Gateway endpoint using .env:
``env
VITE_API_BASE=https://<your-api-gateway-id>.execute-api.<region>.amazonaws.com
``
