# Architecture
Browser (static SPA, hash routes `#/studio` etc.) -> `POST /api/ai` (Vercel function) -> Gemini `generateContent` -> normalized JSON -> browser.
Workspace data: IndexedDB stores `hooks`, `perf`, `kv` (profile, folders). Theme: localStorage. Backups: `hooklab-backup-v1.json`.
Scores: the server recomputes the weighted overall score from the eight dimension scores (15/20/15/15/10/10/10/5).
