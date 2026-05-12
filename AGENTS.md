# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

StudySolo is a polyglot monorepo with two core services:

| Service | Stack | Port | Dev command |
|---------|-------|------|-------------|
| Backend | Python 3.12 + FastAPI | 2038 | `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 2038` |
| Frontend | Next.js 16 + React 19 | 2037 | `cd frontend && npx next dev --turbopack -p 2037` |

### Environment setup

- **Backend**: `backend/.venv/` is the Python virtual env. Activate with `source backend/.venv/bin/activate`.
- **Frontend**: Uses `npm` (lockfile is `package-lock.json`). Run `npm install` in `frontend/`.
- **Env files**: Backend needs `backend/.env`, frontend needs `frontend/.env.local`. Copy from `.env.example` files. Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `JWT_SECRET`.

### Running tests

- **Frontend**: `cd frontend && npx vitest --run` (322 tests, property-based with fast-check)
- **Backend**: `cd backend && source .venv/bin/activate && python -m pytest tests -v` (699 tests, requires `hypothesis` and `pytest-asyncio`)
- One frontend test (`integration-fixes.sidebar-nginx.property.test.ts`) fails because it reads a deploy nginx.conf file not present in the repo — this is a known issue and can be ignored.

### Lint

- **Frontend**: `cd frontend && npx eslint .` (0 errors expected; some warnings are OK)
- **Backend**: `cd backend && source .venv/bin/activate && ruff check .` (should pass clean)

### Gotchas

- The backend requires `python3.12-venv` system package for creating virtual environments.
- Backend test dependencies (`hypothesis`, `pytest-asyncio`, `httpx`) are not listed in `requirements.txt` — install them separately for testing.
- The frontend `next.config.ts` throws an error at startup if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing from `.env.local`.
- Backend `config.py` requires `supabase_url`, `supabase_service_role_key`, and `supabase_anon_key` (no defaults) — the server won't start without these in `.env`.
- Frontend proxies `/api/*` to backend via Next.js rewrites — both services must be running for full functionality.
- AI features require at least one AI provider API key configured in backend `.env`.
- Supabase is cloud-hosted (no local DB) — real Supabase credentials are needed for auth/data features.
