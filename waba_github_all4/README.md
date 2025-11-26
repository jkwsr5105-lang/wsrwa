
# WhatsApp Bulk Sender (WABA) - GitHub-ready Repo

This repository contains a simple WhatsApp Cloud API bulk sender (demo). It's intended for users who want a drop-in project to host on a server or deploy via Docker.

## Contents
- `server/` - Node.js Express server (serves frontend + API)
- `web/` - Simple static frontend
- `Dockerfile.server` - Dockerfile for the server
- `docker-compose.yml` - Compose to run locally
- `.github/workflows/ci.yml` - Basic CI workflow

## Setup (local / server)
1. Create a repo on GitHub and push these files.
2. Create a `.env` file in the `server` folder (or set env vars in your server host):
   ```
   WABA_TOKEN=your_whatsapp_cloud_api_token
   WABA_PHONE_ID=your_phone_id_from_meta
   PORT=3000
   ```
3. Install & run:
   - Locally without Docker:
     ```
     cd server
     npm install
     npm start
     ```
   - With Docker:
     ```
     docker compose up --build
     ```
4. Open `http://localhost:3000` and use the UI.

## Important notes & legal
- This project uses Meta's WhatsApp Cloud API. You must have a WhatsApp Business Account and valid Cloud API token.
- Respect anti-spam laws and WhatsApp policies. Bulk messaging without consent can get your number/app banned.
- This demo sends messages sequentially; for larger volumes, implement rate limiting, batching, retries, and webhooks.

## Want help?
I can help you create a GitHub repo structure, add features (CSV import, scheduling, templates), or prepare it for deployment on Render/Heroku.
