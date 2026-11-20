# Motorlane

Used-car marketplace portfolio project. Next.js frontend and FastAPI backend
live in one repository and run as independent applications.

Current milestone: the API supports car CRUD with PostgreSQL, Docker Compose,
Alembic migrations and database tests. The homepage checks API health over HTTP.
See [API instructions](api/README.md) for the contract, Docker setup and tests.
Login, frontend car listings, cloud integrations and deployment remain future work.

## Requirements

- Python 3.12 and uv
- Node.js 24 LTS and npm

## Run locally

In terminal 1:

```bash
cd api
docker compose up -d --wait db
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

In terminal 2:

```bash
cd web
npm ci
npm run dev
```

Open http://localhost:3000. The page should report that the API is connected.
API docs: http://localhost:8000/docs. Health: http://localhost:8000/health.
`/health` confirms this API process responds; it does not test any database.

Defaults work without env files. For a different origin, copy api/.env.example
to api/.env and run `uv run --env-file .env uvicorn app.main:app --reload`.
For a different API URL, copy web/.env.local.example to web/.env.local and restart
Next.js. NEXT_PUBLIC_API_URL is public and compiled into the frontend bundle.

## Checks

```bash
cd api
uv run ruff check .
uv run ruff format --check .
docker compose --profile test up -d --wait db-test
uv run pytest -q
```

```bash
cd web
npm run lint
npm run typecheck
npm run build
```

## Working with Codex

Starter verification: backend Ruff checks, frontend lint/typecheck/production
build, and live HTTP startup checks passed. A browser smoke check was attempted
but Chromium could not launch in the restricted build environment. Verify the
connected and unavailable states in your local browser before the first commit.

Use AGENTS.md plus api/AGENTS.md and web/AGENTS.md for scoped guidance. Start
Codex in the repo root and explicitly ask it to read the applicable nested file.
Read the diff yourself: instructions do not guarantee correct output.

Give one ticket at a time:

```text
Read AGENTS.md and the AGENTS.md files for the areas you change.
Task: [one user-visible outcome]
Acceptance: [observable success and relevant failure case]
Scope: [files/features allowed; what comes later]
Inspect first, implement the smallest clear solution, and run relevant checks.
Do not commit. Explain the diff and checks so I can review the change.
```

Keep a branch per ticket and commit working checkpoints after review. Commit
uv.lock and package-lock.json; exclude virtual environments, node_modules,
build output and secrets. This starter has no commits or remote configured.

To begin history on your Mac after extracting into a new directory:

```bash
git init -b main
git status --short
git add .
git diff --cached
git commit -m "chore: initialize Next.js and FastAPI applications"
git switch -c feat/listings-read-api
```

## Next ticket

Display the paginated `/cars` results on the frontend using the documented API
contract. FastAPI owns authorization and data access; Next.js will not become
a second business backend. Authentication remains future work.

Next.js requires a server runtime for SSR; the earlier Vite/static-site deployment
plan must be revised when we reach deployment. There is no deployment in this slice.

## Authentication

Run `cd api && uv run alembic upgrade head` before starting the updated API.
Register and sign in from the account form. Usernames use 3–80 letters, digits or
underscores; passwords require 8–128 characters. API routes are
`POST /auth/register`, `POST /auth/login`, `GET /auth/me`, and `POST /auth/logout`.
Send the returned token as `Authorization: Bearer <token>` for listing writes.
Passwords use salted scrypt; database sessions store token hashes and expire in
24 hours. Sign-out revokes the current token. The browser holds its token only
in memory, so refreshing signs you out. Use HTTPS for deployed API traffic.
Only the creator can edit/delete a listing. Existing unowned listings remain
readable but cannot be edited through the API. Account recovery, email verification
and login rate limiting are not implemented.
