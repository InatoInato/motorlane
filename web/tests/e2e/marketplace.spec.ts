import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Car, CarInput } from "../../src/app/cars";

const API = "http://localhost:8001";
const input: CarInput = {
  make: "BMW",
  model: "Touring",
  year: 2021,
  price: 32900,
  milage: 38000,
};
let prefix: string;

test.beforeEach(async ({ request }) => {
  prefix = `web-test-${randomUUID().slice(0, 8)}`;
  const response = await request.get(`${API}/cars?limit=1`);
  expect(response.ok()).toBe(true);
  expect(
    await response.json(),
    "Use the empty motorlane_test database; do not run API pytest at the same time.",
  ).toEqual([]);
});

test.afterEach(async ({ request }) => {
  const response = await request.get(`${API}/cars?limit=100`);
  expect(response.ok()).toBe(true);
  const cars: Car[] = await response.json();
  // Remove only this test's records, even when an assertion failed halfway through.
  for (const car of cars.filter((car) => car.model.startsWith(prefix))) {
    const deleted = await request.delete(`${API}/cars/${car.id}`);
    expect(deleted.status()).toBe(204);
  }
});

async function createCar(
  request: APIRequestContext,
  changes: Partial<CarInput> = {},
) {
  const response = await request.post(`${API}/cars`, {
    data: {
      ...input,
      ...changes,
      model: `${prefix} ${changes.model ?? input.model}`,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Car;
}

async function fillListing(page: Page, car: CarInput) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Make", { exact: true }).fill(car.make);
  await dialog.getByLabel("Model", { exact: true }).fill(car.model);
  await dialog.getByLabel("Year", { exact: true }).fill(String(car.year));
  await dialog
    .getByLabel("Price (USD)", { exact: true })
    .fill(String(car.price));
  await dialog
    .getByLabel("Mileage (km)", { exact: true })
    .fill(String(car.milage));
}

test("creates, reads, edits and deletes a car through the browser", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Sell your car" }).first().click();
  const car = { ...input, model: `${prefix} Touring` };
  await fillListing(page, car);
  const createdResponse = page.waitForResponse(
    (response) =>
      response.url() === `${API}/cars` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish listing" }).click();
  const response = await createdResponse;
  expect(response.status()).toBe(201);
  const created: Car = await response.json();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const open = page.getByRole("button", {
    name: `View BMW ${car.model}`,
    exact: true,
  });
  await expect(open).toBeVisible();

  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: `BMW ${car.model}` }),
  ).toBeVisible();
  await expect(dialog.getByText("38,000 km", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Edit listing", exact: true })
    .click();
  await expect(dialog.getByLabel("Model", { exact: true })).toHaveValue(
    car.model,
  );
  await dialog.getByLabel("Price (USD)", { exact: true }).fill("31000");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  const persisted = await request.get(`${API}/cars/${created.id}`);
  expect(await persisted.json()).toMatchObject({
    ...car,
    price: 31000,
    id: created.id,
  });

  await open.click();
  await dialog
    .getByRole("button", { name: "Delete listing", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Keep listing" }).click();
  expect((await request.get(`${API}/cars/${created.id}`)).status()).toBe(200);
  await dialog
    .getByRole("button", { name: "Delete listing", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Yes, delete listing" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(open).toHaveCount(0);
  expect((await request.get(`${API}/cars/${created.id}`)).status()).toBe(404);
  expect(errors).toEqual([]);
});

test("validates required fields, retains failed input and prevents duplicate submissions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sell your car" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Publish listing" }).click();
  await expect(dialog.locator("input:invalid")).toHaveCount(5);
  const car = { ...input, model: `${prefix} Unsaved` };
  await fillListing(page, car);
  await dialog.getByLabel("Price (USD)", { exact: true }).fill("-1");
  expect(
    await dialog
      .getByLabel("Price (USD)", { exact: true })
      .evaluate((node: HTMLInputElement) => node.checkValidity()),
  ).toBe(false);
  await dialog
    .getByLabel("Price (USD)", { exact: true })
    .fill(String(car.price));

  let submissions = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${API}/cars`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submissions++;
    await held;
    await route.fulfill({ status: 500, json: { detail: "Test failure" } });
  });
  try {
    await dialog.getByRole("button", { name: "Publish listing" }).click();
    await expect(
      dialog.getByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    await expect(dialog.getByLabel("Model", { exact: true })).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally {
    release();
  }
  await expect(dialog.getByRole("alert")).toContainText("Something went wrong");
  expect(submissions).toBe(1);
  await expect(dialog.getByLabel("Model", { exact: true })).toHaveValue(
    car.model,
  );
  await expect(
    dialog.getByRole("button", { name: "Publish listing" }),
  ).toBeEnabled();
});

test("preserves search, brand and budget filters in the URL and sorts results", async ({
  page,
  request,
}) => {
  const bmw = await createCar(request, { model: "Touring", price: 20000 });
  await createCar(request, { make: "Audi", model: "Avant", price: 40000 });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search make or model" })
    .fill("Touring");
  await page
    .getByRole("combobox", { name: "Brand", exact: true })
    .selectOption("BMW");
  await page
    .getByRole("combobox", { name: "Your budget", exact: true })
    .selectOption("25000");
  await page.getByRole("button", { name: "Find my car" }).click();
  await expect(page.locator("#listings .car-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: `View BMW ${bmw.model}` }),
  ).toBeVisible();
  await expect(page).toHaveURL(/q=Touring.*make=BMW.*budget=25000/);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Search make or model" }),
  ).toHaveValue("Touring");
  await expect(
    page.getByRole("combobox", { name: "Brand", exact: true }),
  ).toHaveValue("BMW");
  await expect(
    page.getByRole("combobox", { name: "Your budget", exact: true }),
  ).toHaveValue("25000");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("#listings .car-card")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Sort cars on this page" })
    .selectOption("price-low");
  await expect(page.locator("#listings .card-price").first()).toContainText(
    "$20,000",
  );
  await page
    .getByRole("combobox", { name: "Sort cars on this page" })
    .selectOption("price-high");
  await expect(page.locator("#listings .card-price").first()).toContainText(
    "$40,000",
  );
  await page
    .getByRole("textbox", { name: "Search make or model" })
    .fill("no-such-car");
  await page.getByRole("button", { name: "Find my car" }).click();
  await expect(
    page.getByRole("heading", { name: "A different route, perhaps?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator("#listings .car-card")).toHaveCount(2);
});

test("paginates real inventory without inventing a total count", async ({
  page,
  request,
}) => {
  for (let i = 0; i < 13; i++) await createCar(request, { model: `Car ${i}` });
  await page.goto("/");
  await expect(page.locator("#listings .car-card")).toHaveCount(12);
  await page.getByRole("link", { name: "Next page →" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("#listings .car-card")).toHaveCount(1);
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Next page →" })).toHaveCount(0);
  await page.getByRole("link", { name: "← Previous" }).click();
  await expect(page.locator("#listings .car-card")).toHaveCount(12);
});

test("handles a listing removed by another caller", async ({
  page,
  request,
}) => {
  const car = await createCar(request);
  await page.goto("/");
  expect((await request.delete(`${API}/cars/${car.id}`)).status()).toBe(204);
  await page.getByRole("button", { name: `View BMW ${car.model}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("no longer available");
  await expect(
    dialog.getByRole("button", { name: "Edit listing", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Back to listings" }).click();
  await expect(dialog).toHaveCount(0);
});

test("labels samples honestly, restores keyboard focus and fits the viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every great drive starts somewhere." }),
  ).toBeVisible();
  await expect(
    page.getByText("SAMPLE COLLECTION · NOT FOR SALE"),
  ).toBeVisible();
  await expect(page.locator(".inspiration .car-card")).toHaveCount(3);
  const sell = page.getByRole("button", { name: "Sell your car" }).first();
  await sell.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    // Native dialogs may tab into browser chrome (body), but not background controls.
    expect(
      await page.evaluate(
        () =>
          document.activeElement === document.body ||
          Boolean(document.activeElement?.closest("dialog")),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(sell).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("homepage.png"),
    fullPage: true,
  });
});
