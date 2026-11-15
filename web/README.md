# Motorlane web

Next.js App Router + TypeScript + plain CSS. No additional application packages.
FastAPI owns the data and business rules; Next.js calls it over HTTP.

## Run

Start the API from `api/` with `docker compose up -d --wait db api`.
If reusing the existing containers named `motorlane-api-1` and `motorlane-db-1`,
use `docker compose -p motorlane up -d --wait db api` instead: they belong to the
original Compose project, while the current Compose file has been renamed.
Then, from `web/`:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The default API URL is http://localhost:8000.
To change it, copy `.env.local.example` to `.env.local`, set
`NEXT_PUBLIC_API_URL`, and restart Next.js. That URL is public and must be
reachable from both the Next.js server and the browser. A different frontend
origin also needs to be allowed by the API's `WEB_ORIGIN` setting.

```bash
npm run lint
npm run typecheck
npm run build
```

## Where things live

- `src/app/page.tsx`: fetches one bounded page of cars on the server.
- `src/app/cars.ts`: HTTP calls, response shape checks, car types and formatting.
- `src/app/marketplace.tsx`: browsing, URL filters, cards and page layout.
- `src/app/listing-dialog.tsx`: current details, create, full PUT update and confirmed delete.
- `src/app/globals.css`: responsive styling and keyboard focus states.

The form uses the API's exact `milage` spelling; the UI labels it “Mileage”.
Price is whole USD and mileage is in kilometres. Successful changes refresh the
server-rendered listings. Failed writes preserve the form and show an error.
Dialogs use the native modal element for background isolation and keyboard use.

## Current API limits

`GET /cars` only supports `limit` and `offset`, so search, brand, budget and sort
apply to the current page of 12 cars. The UI states this explicitly. URL
parameters preserve filters and page selection. One extra fetched row determines
whether a next page exists, without inventing an inventory total.

There are no image, location, seller-contact, authentication or ownership fields.
Existing brand photography is labeled “Illustrative photo”; other makes show a
photo-unavailable state. The separate inspiration collection is labeled sample
data, appears only on an unfiltered empty first page, and is never saved to the
API. Listings are not shown as samples during an API outage.

No visual reference attachments were available in this chat. The implementation
follows the requested premium, minimal direction and `AGENTS.md` palette.

## Automated tests

From `web/`, run the fast API-client tests without Docker or a browser:

```bash
npm ci
npm test
```

For the browser tests, install Chromium once and make sure Docker is running.
Stop any `npm run dev` process in this checkout first, since Next.js shares its
development build directory. Install the API dependencies once with
`uv sync --locked` from `api/`, then run these commands from `web/`:

```bash
npx playwright install chromium
npm run test:e2e
```

The browser command starts the disposable Compose `db-test` service, waits for
PostgreSQL, migrates `motorlane_test`, and starts dedicated FastAPI and Next.js
processes on ports 8001 and 3100. Playwright stops these processes afterward.
The development API and its database are not used. Ports 8001 and 3100 must be
free; the suite deliberately refuses to reuse existing servers.

Tests run sequentially against an empty test database and remove only their own
tagged car records after each test, including on failure. Don't run the API's
pytest suite at the same time, because it shares `motorlane_test`.

- `tests/unit/cars.spec.ts`: response validation, pagination boundaries, HTTP
  errors, invalid JSON, failed reads/writes and bodyless DELETE responses.
- `tests/e2e/marketplace.spec.ts`: real CRUD, filters, sorting, pagination,
  validation, failed-save recovery, duplicate submission prevention, removed
  listings, sample labels, keyboard focus and viewport overflow. Every case
  runs at desktop and mobile sizes.

Failure screenshots and traces, plus homepage screenshots, are written to the
ignored `test-results/` directory. To inspect a failed run, use
`npx playwright show-trace <path-to-trace.zip>`.

Stop the test database when finished:

```bash
docker compose -f ../api/compose.yaml --profile test stop db-test
```

## Browser verification

Playwright/Chromium checks on 2026-11-14 covered:

- Live create/read/update/delete against FastAPI and PostgreSQL; temporary QA
  cars were deleted afterward.
- Required-field validation and input retention after a simulated failed save.
- Search, budget, URL persistence after reload, reset, sorting and pagination.
- Mobile details, delete cancellation, modal keyboard navigation, Escape and focus return.
- Empty inventory, actual API outage and recovery through the retry action.
- Screenshots at desktop and mobile sizes; no horizontal overflow at widths
  320, 390, 768, 1024 and 1440 pixels.
- Axe checks of the homepage at desktop/mobile and create dialog.

The initial visual review used browser tools outside this project. Repeatable
tests now use `@playwright/test` as a development dependency; it is not part of
the application's runtime dependencies. Initial visual-review screenshots are
saved in ignored `artifacts/`.

## Photography

Local illustrative assets from Unsplash's image CDN:

- Porsche: https://images.unsplash.com/photo-1503376780353-7e6692767b70
- BMW: https://images.unsplash.com/photo-1555215695-3004980ad54e
- Mercedes: https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8
- Audi: https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6

These images illustrate the visual direction, not a seller's actual vehicle.
