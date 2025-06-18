# InterviewTracker

InterviewTracker is a simple serverless project for tracking job interviews, built using AWS services (DynamoDB, SES, EventBridge), Google OAuth, and Node.js. It provides an API for authenticated users to log and manage their interview experiences, with fields for company, role, interviewers, questions, performance ratings, and more.

## Features

- **Serverless Backend**: Built to run on AWS Lambda with Serverless Framework.
- **Interview Data Management**: Store, retrieve, and filter interview records in DynamoDB.
- **Google Authentication**: Secures access using Google OAuth 2.0.
- **Notification & Events**: Uses AWS SES for emails and EventBridge for event-driven features.
- **Public/Private Entries**: Users can mark interview records as public or private.

## Technologies Used

- Node.js (ES Modules)
- AWS DynamoDB, SES, EventBridge (via AWS SDK v3)
- Google OAuth2 via `google-auth-library`
- Serverless Framework (`serverless-offline` and `serverless-dynamodb-local` for local dev)
- UUID for unique record IDs

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- AWS account & credentials
- Google Cloud project with OAuth2 credentials
- Serverless Framework installed globally

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/AvitalHass/InterviewTracker.git
   cd InterviewTracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy and configure environment variables (e.g., `GOOGLE_CLIENT_ID`, `TABLE_NAME`).

### Running Locally

- Start the local serverless environment:
  ```bash
  npm start
  ```

- The API will be available via `serverless-offline`.

## Usage

- Authenticate using your Google account (OAuth2).
- Use the API to:
  - Add new interview records
  - List/filter your interviews
  - Update interview details
  - Mark records as public/private

## Example API (from handler.js)

- `GET /interviews`: List interviews filtered by user, status, or public/private.
- Authentication required via Google OAuth2 token in the `Authorization` header.

## License

ISC

---

> _Note: This README is based on auto-detected project files and may require edits for accuracy or completeness._
