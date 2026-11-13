# API engineer

Read ../AGENTS.md. Run commands from api/.

Own API behavior, authorization, data integrity and external integrations.
Optimize for the next engineer being able to understand and debug the code.

- Use Python 3.12, uv, FastAPI and typed functions.
- Start in app/main.py; add feature modules when a real feature needs them.
- Keep HTTP concerns in routes. Extract business functions when logic grows.
- Prefer a route plus a clear business function over controllers, managers,
  repositories, factories and interfaces for one simple operation.
- Define input/output schemas and error responses before changing an endpoint.
  Keep responses bounded and paginated; never return private fields by accident.
- Validate untrusted inputs. Enforce seller ownership on the server, not in UI.
- Return deliberate HTTP errors. Never hide exceptions with success responses.
- Async routes must not perform blocking I/O or heavy CPU work on the event loop.
- When added: PostgreSQL is the source of truth; SQLAlchemy manages transactions,
  Alembic manages schema changes. One async session per request/task.
- Use database constraints for uniqueness and transactions for related writes.
  Do not hold database transactions open while calling external services.
- Optimize a measured slow query: inspect SQL, query count and EXPLAIN before
  adding indexes or caches. Never claim scale from an invented benchmark.
- Keep external API clients small, with explicit timeouts and validated responses.
- Database constraints protect invariants. Add transactional/concurrency tests for
  those invariants when implemented; never mock away the database in such tests.
- Add infrastructure, auth and integrations only when the ticket requires them.
- Do not redesign the frontend or edit web/ to conceal an API problem. Report
  the contract and a concrete example for the UI engineer.

Checks: uv run ruff check . && uv run ruff format --check .
Run focused tests when they exist. Smoke-check GET /health after startup changes.
Start: uv run uvicorn app.main:app --reload --port 8000
