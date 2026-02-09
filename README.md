# OVMS Mate

A TeslaMate-inspired monitoring dashboard for OVMS vehicles.

## Architecture

*   **Frontend**: React App (Deployed on Vercel)
*   **Backend**: Node.js TCP Logger (Deployed via Docker)
*   **Database**: Supabase (PostgreSQL)

## How to Deploy

### 1. Frontend (Vercel)
Connect this repository to Vercel. Add your Supabase Environment variables in the Vercel Dashboard.

### 2. Backend Logger (Docker)
The logger must run 24/7 to collect data.

**Option A: Run with Docker Compose (Recommended for VPS/NAS)**
1. Edit `docker-compose.yml` and fill in your `OVMS_` and `SUPABASE_` credentials.
2. Run:
   ```bash
   docker-compose up -d
   ```

**Option B: Run locally (for testing)**
1. Fill in credentials in `.env` (create one based on the variables in docker-compose).
2. Run:
   ```bash
   npm run start-logger
   ```
