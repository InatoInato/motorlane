# Motorlane API

Small FastAPI car CRUD backed by PostgreSQL. Routes live in `app/main.py`,
schemas in `app/schemas.py`, and the model/session setup in `app/database.py`.
Alembic owns schema changes. There are no repository or service layers.

## Run everything with Docker

Run commands from `api/`:

```bash
docker compose up --build -d --wait api
curl http://localhost:8000/health
```

Open http://localhost:8000/docs to try CRUD. Compose waits for PostgreSQL and Moto, initializes the local bucket,
runs migrations, then starts the API. PostgreSQL is available on localhost:5433.
The credentials in Compose are for local development. `/health` checks only
that the API process responds, not database readiness.

## Run Python locally, PostgreSQL and Moto in Docker

```bash
docker compose up -d --wait db moto
uv sync --locked
# Copy the example on first setup or add its AWS_* and S3_* values to your .env.
cp -n .env.example .env
uv run --env-file .env python -m app.photo_storage
uv run --env-file .env alembic upgrade head
uv run --env-file .env uvicorn app.main:app --reload --port 8000
```

Stop the Compose API first (`docker compose stop api`) if port 8000 is in use.
The bucket setup command can be run repeatedly.

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

Listing writes require a bearer token. Only the seller can edit, delete, or
upload a cover for a listing.

## Tests and checks

```bash
uv sync --locked
docker compose --profile test up -d --wait db-test moto-test
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
docker compose --profile test stop db-test moto-test
```

Tests use real PostgreSQL on localhost:5434 and run migrations before testing.
Each test rolls back an outer transaction, including route commits. The test
container has disposable storage, separate from development data. An optional
`TEST_DATABASE_URL` must point to a separate database named `motorlane_test`.

To stop all containers while keeping the PostgreSQL development volume
(Moto stores photos in memory and loses them when stopped):

```bash
docker compose --profile test down
```

`docker compose --profile test down -v` also deletes the development database
volume. Use it only when you want a fresh database.

## Favorites

After upgrading migrations (`uv run alembic upgrade head`), authenticated users
can `PUT /favorites/{car_id}` to save a car and `DELETE /favorites/{car_id}` to
remove it. Both return 204, including repeated requests. Saving a missing car
returns 404; removing a missing/deleted favorite returns 204.
`GET /favorites?limit=20&offset=0` returns only the caller's saved cars, newest
first with car ID as a stable tie breaker; limit is 1–100. `GET /favorites/{car_id}`
returns `{"saved": true|false}` for the caller. User identity always comes from
the bearer session, never from request input. The composite primary key enforces
one favorite per user/car. Deleting a car cascades to all associated favorites.

## Cover photos

Open a listing you own in the web app, choose a file under **Cover photo**, and
select **Upload cover** or **Replace cover**. The API accepts multipart
`PUT /cars/{id}/photo` with the `photo` file field and a seller bearer token.
It accepts JPEG, PNG and WebP up to 5 MiB and 25 million decoded pixels across
frames. Listing responses contain `photo_url`, either null or a signed URL that
expires after five minutes. Fetch the listing again to get a fresh URL.

Local Compose uses dummy AWS credentials. `S3_PHOTO_BUCKET` sets the bucket,
`S3_ENDPOINT_URL` is the API's storage endpoint, and
`S3_PUBLIC_ENDPOINT_URL` is the URL hostname the browser can reach.
Compose sets the internal endpoint to `http://moto:5000` (override it with
`S3_DOCKER_ENDPOINT_URL`) and signs for `http://127.0.0.1:5000`. When Python runs on the host, both endpoints can use
`http://127.0.0.1:5000`. The API signs the public URL directly, so do not
rewrite its hostname. Restart just the API with `docker compose restart api`
to retain Moto's in-memory objects. Recreating or stopping Moto loses them.

For AWS, provision a private S3 bucket, set `S3_PHOTO_BUCKET` and the AWS region,
leave both endpoint overrides unset, and provide a role with
`s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` for the cover prefix.
Boto3 uses its default credential chain. The local Compose initializer is for
Moto. It should not be used to manage AWS buckets.

The test Moto server listens on localhost:5001. Pytest creates a fresh bucket
for each cover test and removes it afterward. From `web/`, run
`npx playwright install chromium` once, then `npm run test:e2e`. That command
starts both test containers and creates the browser test bucket. Run pytest and
Playwright sequentially because they share the test database.
