# OVMS Mate

A TeslaMate-inspired monitoring dashboard for OVMS vehicles.

## Architecture

*   **Frontend**: React App (Deployed on Vercel)
*   **Backend**: Node.js TCP Logger (Deployed via Docker)
*   **Database**: Supabase (PostgreSQL)

## Configuration (.env)

**Crucial Step:** You must create a `.env` file in the root directory to store your credentials.

1.  Copy the example file:
    ```bash
    cp .env.example .env
    ```
2.  Edit `.env` and fill in your:
    *   **OVMS Credentials**: ID, Password, and Server.
    *   **Supabase Keys**: URL and Anon Key.
    *   **Google Gemini Key**: API Key for AI features.

## How to Deploy

### 1. Frontend (Vercel)
Connect this repository to Vercel. Add your Supabase Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and `API_KEY` in the Vercel Dashboard Settings.

### 2. Backend Logger (Docker)
The logger must run 24/7 to collect data.

#### Dockerfile Reference
If you need to build the image manually, here is the standard `Dockerfile` used in this project:

```dockerfile
# Use standard Node.js Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first to utilize Docker cache for dependencies
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Start the backend logger using the script defined in package.json
CMD ["npm", "run", "start-logger"]
```

**Option A: Run with Docker Compose (Recommended for VPS/NAS)**
1. Ensure your `.env` file is populated.
2. Run:
   ```bash
   docker-compose up --build -d
   ```

**Option B: Run locally (for testing)**
1. Ensure your `.env` file is populated.
2. Run:
   ```bash
   npm run start-logger
   ```