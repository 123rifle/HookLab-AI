# HookLab: Turn attention into retention

AI-powered hook creation and optimization workspace. Vanilla JS single-page app, local-first (IndexedDB), with a minimal Vercel serverless gateway to Google Gemini. No accounts, no database, no paid services.

## Structure
- `index.html`, `css/app.css`: single entry point and design system (hash-routed SPA, no reloads)
- `js/app.js`: router, state, all nine views, shared actions (send hooks between tools)
- `js/db.js`: IndexedDB storage, export/import with `hooklab-backup-v1` validation
- `js/ai.js`: client for `/api/ai` (duplicate-request guard, 35s timeout)
- `api/ai.js`: gateway (`generate`, `analyze`, `rewrite`, `compare`), validation, prompts, response normalization

## Run locally
1. `npm i -g vercel`
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` (never commit it).
3. `vercel dev` and open the printed URL.

## Deploy (beginner steps)
1. Create a GitHub repository and upload every file in this folder (the `.env.local` file must NOT be included).
2. Go to vercel.com, sign in with GitHub, click **Add New > Project**, import the repo.
3. Framework preset: **Other**. Leave build and output settings empty. Do not deploy yet.
4. Open **Environment Variables** and add: `GEMINI_API_KEY` (from Google AI Studio), `GEMINI_MODEL` (e.g. `gemini-2.5-flash`; check Google's current model list), `AI_ENABLED` = `true`. Optionally `ALLOWED_ORIGIN` = your production URL.
5. Click **Deploy**.
6. Open the live URL, go to Hook Studio, generate hooks. If you see an error, check the variables and redeploy.
7. To update: commit/push changes to GitHub; Vercel redeploys automatically.
8. **Emergency stop:** Vercel > Settings > Environment Variables, set `AI_ENABLED` = `false`, then redeploy. All AI calls are refused before Gemini is contacted.

## Security notes
- The API key exists only as a server environment variable; the browser never receives it.
- The server accepts only four operations, validates and length-limits every field, caps request size (40 KB), hook count (8) and Gemini output tokens, times out after 25s, and logs no creative content.
- **Limitation:** the rate limiter is in-memory per serverless instance. It slows casual abuse but is NOT a reliable global or per-IP limit, and a determined attacker can exhaust your Gemini quota. Without shared storage (prohibited here) no complete fix exists. Use the kill switch, set quota limits in Google AI Studio / Cloud console, and monitor usage. Do not treat this API as abuse-proof.
- Gemini free-tier quotas and models change; verify them in Google's documentation.

## Privacy
Workspace data stays in the browser. AI requests send only the relevant input and profile fields through the server to Google Gemini. See Settings in the app for the full statement.

## Testing status
Automated in a sandbox: syntax checks and mocked gateway tests (invalid op, oversize input, compare limits, kill switch, quota error, invalid JSON, weighted scoring). **Not yet tested:** live Gemini calls, real-browser UI flows, and the 375/768/1024/1440 px layouts. Run through the checklist below after deploying.

Checklist: all nine nav items; generate/analyze/rewrite/compare; save, edit, favorite, archive, delete; folders, search, filters; profile; performance records and charts; export, import (also try an invalid file), clear workspace; refresh persistence; back/forward; view source for no key.
