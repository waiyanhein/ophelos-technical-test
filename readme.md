# Time Spent
I spent approximately 12 - 15 hours (on and off) working on this project. Development would likely have been faster if I had access to more credits from Anthropic.

# Project Setup

Before running the project, make sure the following are installed on your machine:

- Node.js (v20.x or later)
- npm
- Docker

---

## Installation

You only need to complete these steps the first time you set up the project.

### Backend Setup

From the `backend` directory, run:

```bash
npm install
cp .env.example .env
```

Update the environment variables in the `.env` file with the correct credentials.  
For example, set `LLM_API_KEY` to your OpenAI API key.

### Frontend Setup

From the `frontend` directory, run:

```bash
npm install
```

---

## Database Setup

Run the database migrations and seed the local development data:

```bash
npm run db:migrate
npm run db:seed
```

---

## Running the Project Locally

### 1. Start the Docker Containers

From the project root directory, run:

```bash
npm run dev:up
```

### 2. Start the Backend Server

From the project root directory, run:

```bash
npm run be:dev
```

Once the server is running, the API will be available at:

```text
http://localhost:3000
```

Keep this terminal window open.

### 3. Start the Frontend Application

Open a new terminal window and run the following command from the project root directory:

```bash
npm run fe:dev
```

---

## Running the Tests

Run the following commands from the project root directory:

```bash
npm run test:up   # Starts the Docker containers required for testing
npm run test      # Runs the test suite
```

---

## Tests

At the moment, only backend tests have been implemented.  
End-to-end tests for the frontend will be added in the future using Playwright or Cypress.

# Prompt History
#### Claude Code Prompt History
- The exported files can be found in the `/prompt-history` directory.
#### Claude Chat History
- https://claude.ai/share/89e5c4c4-4899-4b33-b21b-81aaf2f46829
- etc.