# Motorlane API

Small FastAPI car CRUD backed by PostgreSQL. Routes live in `app/main.py`,
schemas in `app/schemas.py`, and the model/session setup in `app/database.py`.
Alembic owns schema changes. There are no repository or service layers.

## Run everything with Docker

Run commands from `api/`:

```bash
docker compose up --build -d
curl http://localhost:8000/health
```

Open http://localhost:8000/docs to try CRUD. Compose waits for PostgreSQL,
runs migrations, then starts the API. PostgreSQL is available on localhost:5433.
The credentials in Compose are for local development. `/health` checks only
that the API process responds, not database readiness.

## Run Python locally, PostgreSQL in Docker

```bash
docker compose up -d --wait db
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

Stop the Compose API first (`docker compose stop api`) if port 8000 is in use.
Defaults work without an env file. For custom settings, copy `.env.example`
to `.env` and use `uv run --env-file .env` for both Alembic and Uvicorn.

## Contract

| Method | Path | Result |
| --- | --- | --- |
| POST | `/cars` | Create; 201 and `Location` header |
| GET | `/cars?limit=20&offset=0` | List ordered by ID; maximum 100 per page |
| GET | `/cars/{id}` | Read one car |
| PUT | `/cars/{id}` | Replace all editable fields |
| DELETE | `/cars/{id}` | Permanently delete; 204 with no body |

POST and PUT accept the same required fields:

```json
{"make":"Toyota","model":"Camry","year":2020,"price":18000,"milage":65000}
```

Responses contain those fields plus the generated integer `id`. `price` is
whole US dollars; `milage` is kilometres. Names are trimmed and limited to 80
characters. Year must be 1886–2100. Price and milage are nonnegative 32-bit
integers. Unknown fields are rejected. Invalid input returns FastAPI's 422
validation details; missing cars return 404 with `{"detail":"Car not found"}`.

Example:

```bash
curl -i http://localhost:8000/cars \
  -H 'Content-Type: application/json' \
  -d '{"make":"Toyota","model":"Camry","year":2020,"price":18000,"milage":65000}'
curl 'http://localhost:8000/cars?limit=10&offset=0'
```

This local learning API has no authentication or seller accounts; any caller
can change cars. Frontend integration and seller authorization are future work.

## Tests and checks

```bash
uv sync --locked
docker compose --profile test up -d --wait db-test
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
docker compose --profile test stop db-test
```

Tests use real PostgreSQL on localhost:5434 and run migrations before testing.
Each test rolls back an outer transaction, including route commits. The test
container has disposable storage, separate from development data. An optional
`TEST_DATABASE_URL` must point to a separate database named `motorlane_test`.

To stop all containers while keeping development data:

```bash
docker compose --profile test down
```

`docker compose --profile test down -v` also deletes the development database
volume. Use it only when you want a fresh database.
