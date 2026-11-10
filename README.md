# Bhai Phota website + Telegram notifications

The frontend (`index.html`) and Node.js notification backend are served by the **same server**. The browser calls `/api/phota` and `/api/message` using relative URLs, so no localhost or deployed backend URL needs to be changed between environments.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder, install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your Telegram bot token and chat ID.
4. Start the server:
   ```bash
   npm start
   ```
5. Open <http://localhost:3000> in your browser. Do not open `index.html` directly with Live Server; the Node server now serves the page and its API together.

## Deploy to Render (one service)

1. Push this entire project folder to a GitHub repository. Keep `index.html`, `server.js`, `package.json`, and `package-lock.json` (if generated) in the repository root.
2. In Render, choose **New → Web Service** and connect the GitHub repository.
3. Use these settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. In Render → Environment, add:
   - `TELEGRAM_BOT_TOKEN` = your Telegram bot token
   - `TELEGRAM_CHAT_ID` = your Telegram chat ID
5. Deploy. Render provides a URL such as `https://your-service.onrender.com`. Open that URL; the HTML and API are both served from it.

Do not create a separate Render Static Site. Do not set `FRONTEND_ORIGIN`; CORS is not needed because the frontend and API share the same origin. Do not commit `.env` or put Telegram credentials in frontend code. The `.gitignore` excludes `.env`.

## API endpoints

- `GET /` — serves the website.
- `GET /health` — health check.
- `POST /api/phota` — accepts `{ "event": "bhai_phota" }`.
- `POST /api/message` — accepts `{ "name": "Priya", "message": "..." }`; `name` is optional.

Both POST endpoints send Telegram notifications. The server validates payloads and rate-limits requests.
