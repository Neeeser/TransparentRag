# Ragworks Console (Next.js)

A glassy operator console for the Ragworks backend. It surfaces authentication, dashboards, collection management, retrieval inspection, and chat telemetry on top of the FastAPI service.

## Quick start

```bash
cd frontend
npm install
export NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8000" # optional, defaults to localhost:8000
npm run dev
```

Now open http://localhost:3000 and sign in with credentials created via the API/CLI.

## Environment

- `NEXT_PUBLIC_API_BASE_URL` – FastAPI origin (defaults to `http://127.0.0.1:8000`). All fetches go through this base; no rebuild needed when you swap hosts.

## Scripts

- `npm run dev` – local development with hot reload.
- `npm run lint` – ESLint/TypeScript checks.
- `npm run build` – production build verification.
- `npm run start` – serve the compiled build.

## Feature map

- **Landing + Auth** – marketing-style landing page plus a combined register/sign-in form that talks to `/api/auth/register` and `/api/auth/token`.
- **Dashboard** – real-time cards for collection/document counts, context utilization, chunking health, and recent ingestion activity.
- **Collections workspace** – create collections (chunk strategy, size, overlap), upload PDFs/text, inspect stored chunks, and run ad-hoc similarity queries.
- **Chat studio** – browse chat sessions per collection, send new turns, and inspect tool traces + token usage for every response.

The UI is intentionally visual: translucent panels, model badges, score bars, and chunk viewers help communicate what the backend is doing at every step of the RAG pipeline.
