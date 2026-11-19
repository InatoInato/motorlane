import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
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
let token: string;
let username: string;
const fixtureModels = new Set<string>();
const screenshotStyle = "nextjs-portal { display: none; }";

test.beforeEach(async ({ request }) => {
  fixtureModels.clear();
  prefix = `web-test-${randomUUID().slice(0, 8)}`;
  username = `seller_${randomUUID().slice(0, 8)}`;
  const data = { username, password: "test-password-123" };
  await request.post(`${API}/auth/register`, { data });
  token = (await (await request.post(`${API}/auth/login`, { data })).json())
    .token;
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
  for (const car of cars.filter(
    (car) => car.model.startsWith(prefix) || fixtureModels.has(car.model),
  )) {
    const deleted = await request.delete(`${API}/cars/${car.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleted.status()).toBe(204);
  }
});

async function createCar(
  request: APIRequestContext,
  changes: Partial<CarInput> = {},
  fixtureModel?: string,
) {
  if (fixtureModel) fixtureModels.add(fixtureModel);
  const response = await request.post(`${API}/cars`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...input,
      ...changes,
      model: fixtureModel ?? `${prefix} ${changes.model ?? input.model}`,
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByLabel(`Account: ${username}`, { exact: true }),
  ).toBeVisible();
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
  const open = page.getByRole("link", {
    name: `View BMW ${car.model}`,
    exact: true,
  });
  await expect(open).toBeVisible();

  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(
    page.getByRole("heading", { name: `BMW ${car.model}` }),
  ).toBeVisible();
  await expect(page.getByText("38,000 km", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit listing", exact: true }).click();
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

  await page
    .getByRole("button", { name: "Delete listing", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep listing" }).click();
  expect((await request.get(`${API}/cars/${created.id}`)).status()).toBe(200);
  await page
    .getByRole("button", { name: "Delete listing", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, delete listing" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/#listings$/);
  await expect(open).toHaveCount(0);
  expect((await request.get(`${API}/cars/${created.id}`)).status()).toBe(404);
  expect(errors).toEqual([]);
});

test("validates required fields, retains failed input and prevents duplicate submissions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByLabel(`Account: ${username}`, { exact: true }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByLabel(`Account: ${username}`, { exact: true }),
  ).toBeVisible();
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
    page.getByRole("link", { name: `View BMW ${bmw.model}` }),
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
    page.getByRole("heading", { name: "No cars match these filters" }),
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByLabel(`Account: ${username}`, { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#listings .car-card")).toHaveCount(12);
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("#listings .car-card")).toHaveCount(1);
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Next" })).toHaveCount(0);
  await page.getByRole("link", { name: "Previous" }).click();
  await expect(page.locator("#listings .car-card")).toHaveCount(12);
});

test("handles a listing removed by another caller", async ({
  page,
  request,
}) => {
  const car = await createCar(request);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByLabel(`Account: ${username}`, { exact: true }),
  ).toBeVisible();
  expect(
    (
      await request.delete(`${API}/cars/${car.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(204);
  await page.getByRole("link", { name: `View BMW ${car.model}` }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "no longer available",
  );
  await expect(
    page.getByRole("button", { name: "Edit listing", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Back to listings" }).click();
  await expect(page.locator("#listings .car-card")).toHaveCount(0);
});

test("shows real inventory only, restores keyboard focus and fits the viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByLabel(`Account: ${username}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No listings on this page" }),
  ).toBeVisible();
  await expect(page.locator(".car-card")).toHaveCount(0);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await sell.evaluate((node) => getComputedStyle(node).transitionDuration),
  ).toBe("0s");
  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 640 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await sell.click();
    expect(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await expect(
      dialog.getByRole("button", { name: "Choose photo", exact: true }),
    ).toBeVisible();
  }
});

test("registers in a modal, reports errors and signs out", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByLabel("Username", { exact: true })).toHaveCount(0);
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  await signIn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Sign in");
  await expect(
    dialog.getByText("8–128 characters.", { exact: true }),
  ).toHaveCount(0);
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("wrong-password-123");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "valid username and password",
  );
  await expect(dialog.getByLabel("Username", { exact: true })).toHaveValue(
    username,
  );
  await dialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(dialog).toHaveAccessibleName("Create account");
  await expect(
    dialog.getByText("8–128 characters.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-password-123");
  await dialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("already taken");
  const password = dialog.getByLabel("Password", { exact: true });
  await password.fill("1234567");
  expect(
    await password.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
  await password.fill("12345678");
  expect(
    await password.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(true);
  const newUser = `new_${randomUUID().slice(0, 8)}`;
  await dialog.getByLabel("Username", { exact: true }).fill(newUser);
  await dialog.getByRole("button", { name: "Show password" }).click();
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await dialog.getByRole("button", { name: "Hide password" }).click();
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.screenshot({ path: testInfo.outputPath("registration.png") });
  await dialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const account = page.getByLabel(`Account: ${newUser}`, { exact: true });
  await expect(account).toBeFocused();
  await account.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(signIn).toBeFocused();
});

test("contains focus, closes on Escape and resumes selling", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const sell = page.getByRole("button", { name: "Sell your car" }).first();
  await sell.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Sign in");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () =>
          document.activeElement === document.body ||
          Boolean(document.activeElement?.closest("dialog")),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest("dialog")),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(sell).toBeFocused();
  await sell.click();
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-password-123");
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("sign-in.png") });
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("List your car");
  await expect(dialog.getByLabel("Make", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sell).toBeFocused();
});

test("preserves auth input on network and server errors and prevents duplicate submissions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-password-123");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  await page.route(`${API}/auth/login`, async (route) => {
    submissions++;
    await held;
    await route.fulfill({ status: 500, json: { detail: "Failure" } });
  });
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Please wait…" }),
  ).toBeDisabled();
  await expect(dialog.getByLabel("Username", { exact: true })).toBeDisabled();
  release();
  await expect(dialog.getByRole("alert")).toContainText("account request");
  expect(submissions).toBe(1);
  await expect(dialog.getByLabel("Username", { exact: true })).toHaveValue(
    username,
  );
  await page.unroute(`${API}/auth/login`);
  await page.route(`${API}/auth/login`, (route) => route.abort());
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("reach your account");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("favorites prompt sign-in, sync cards and details, and support a private favorites page", async ({
  page,
  request,
}, testInfo) => {
  const car = await createCar(request);
  await page.goto("/");
  const card = page.locator("#listings .car-card");
  await card
    .getByRole("button", { name: "Save to favorites", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Sign in");
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-password-123");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Remove from favorites" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: `View BMW ${car.model}` }).click();
  const details = page.locator("main");
  await details.getByRole("button", { name: "Remove from favorites" }).click();
  await expect(
    details.getByRole("button", { name: "Save to favorites" }),
  ).toHaveAttribute("aria-pressed", "false");
  await details.getByRole("button", { name: "Save to favorites" }).click();
  await expect(
    details.getByRole("button", { name: "Remove from favorites" }),
  ).toBeVisible();
  let releaseFavorites!: () => void;
  const heldFavorites = new Promise<void>((resolve) => {
    releaseFavorites = resolve;
  });
  await page.route(`${API}/favorites?*`, async (route) => {
    await heldFavorites;
    await route.continue();
  });
  await page.getByRole("link", { name: "My favorites" }).click();
  try {
    await expect(page.getByRole("status")).toHaveText("Loading favorites…");
  } finally {
    releaseFavorites();
  }
  await expect(
    page.getByRole("heading", { name: "My favorites" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `BMW ${car.model}`, exact: true }),
  ).toBeVisible();
  await page.unroute(`${API}/favorites?*`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("favorites.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Remove from favorites" }).click();
  await expect(
    page.getByRole("heading", { name: "No favorites on this page." }),
  ).toBeVisible();
  await page.route(`${API}/favorites?*`, (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Browse cars", exact: true })
    .click();
  await page.getByRole("link", { name: "My favorites" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Something went wrong",
  );
  await page.unroute(`${API}/favorites?*`);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No favorites on this page." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Sign in to see your saved cars.")).toBeVisible();
});

test("publishes, retries a failed cover, and replaces it without losing the old cover", async ({
  page,
  request,
}, testInfo) => {
  const model = "M3 Competition";
  fixtureModels.add(model);
  const name = "BMW " + model;
  const alt = "Cover photo of " + name;
  const dialog = page.getByRole("dialog");
  await page.goto("/");
  await page.getByRole("button", { name: "Sell your car" }).click();
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-password-123");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("List your car");
  await fillListing(page, { ...input, model });

  if (testInfo.project.name === "desktop") {
    const bytes = Array.from(await readFile("public/images/bmw.jpg"));
    const transfer = await page.evaluateHandle((data) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(data)], "bmw.jpg", { type: "image/jpeg" }),
      );
      return transfer;
    }, bytes);
    await dialog
      .locator(".photo-picker")
      .dispatchEvent("dragover", { dataTransfer: transfer });
    await expect(dialog.locator(".photo-picker")).toHaveAttribute(
      "data-dragging",
      "true",
    );
    await dialog
      .locator(".photo-picker")
      .dispatchEvent("drop", { dataTransfer: transfer });
    await transfer.dispose();
  } else {
    const chooser = page.waitForEvent("filechooser");
    await dialog
      .getByRole("button", { name: "Choose photo", exact: true })
      .click();
    await (await chooser).setFiles("public/images/bmw.jpg");
  }

  const preview = dialog.getByRole("img", { name: "Selected cover preview" });
  await expect
    .poll(() => preview.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("seller-photo.png"),
    style: screenshotStyle,
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const uploads = API + "/cars/*/photo";
  await page.route(uploads, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    await held;
    await route.fulfill({
      status: 503,
      json: { detail: "Photo storage unavailable" },
    });
  });
  try {
    await dialog.getByRole("button", { name: "Publish listing" }).click();
    await expect(
      dialog.getByRole("button", { name: "Uploading…" }),
    ).toBeDisabled();
    await expect(dialog.getByRole("status")).toContainText("Listing saved.");
  } finally {
    release();
  }
  await expect(dialog.getByRole("alert")).toContainText(
    "cover couldn't be saved",
  );
  await expect(dialog.getByLabel("Model", { exact: true })).toHaveValue(model);
  await expect(preview).toBeVisible();

  const saved: Car[] = await (await request.get(API + "/cars")).json();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ model, photo_url: null });
  const detailPath = "/cars/" + saved[0].id;
  await page.unroute(uploads);
  await dialog.getByRole("button", { name: "Retry photo upload" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Listing published with its cover photo." }),
  ).toBeVisible();
  expect(await (await request.get(API + "/cars")).json()).toHaveLength(1);

  await page.getByRole("link", { name: "View " + name }).click();
  const details = page.locator("main");
  const cover = details.getByRole("img", { name: alt, exact: true });
  await expect
    .poll(() => cover.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);
  const firstUrl = new URL((await cover.getAttribute("src"))!);
  expect(firstUrl.host).toBe("localhost:5001");
  expect(firstUrl.searchParams.has("X-Amz-Signature")).toBe(true);
  await details
    .getByRole("button", { name: "Edit listing", exact: true })
    .click();
  await dialog.getByLabel("Cover photo", { exact: true }).setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("bad image"),
  });
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "valid JPEG, PNG or WebP",
  );
  const oldInForm = dialog.getByRole("img", { name: alt, exact: true });
  expect(new URL((await oldInForm.getAttribute("src"))!).pathname).toBe(
    firstUrl.pathname,
  );
  expect((await request.get(firstUrl.toString())).ok()).toBe(true);

  const resized = await page.evaluate(async () => {
    const source = await fetch("/images/bmw.jpg");
    const photo = await createImageBitmap(await source.blob());
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(photo.width * 0.8);
    canvas.height = Math.round(photo.height * 0.8);
    canvas
      .getContext("2d")!
      .drawImage(photo, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  });
  const replacement = Buffer.from(resized, "base64");
  await dialog.getByLabel("Cover photo", { exact: true }).setInputFiles({
    name: "bmw-replacement.jpg",
    mimeType: "image/jpeg",
    buffer: replacement,
  });
  await dialog.getByRole("button", { name: "Retry photo upload" }).click();
  await expect(details.getByRole("status")).toContainText(
    "Listing updated and cover photo saved.",
  );
  await expect
    .poll(async () => new URL((await cover.getAttribute("src"))!).pathname)
    .not.toBe(firstUrl.pathname);

  await page.reload();
  await expect(page).toHaveURL(new RegExp(detailPath + "$"));
  await expect
    .poll(() => cover.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);
  const replacementUrl = new URL((await cover.getAttribute("src"))!);
  const download = await request.get(replacementUrl.toString());
  expect(download.ok()).toBe(true);
  expect(await download.body()).toEqual(replacement);
  await page.screenshot({
    path: testInfo.outputPath("listing-cover.png"),
    style: screenshotStyle,
  });
  await page.getByRole("link", { name: "Back to listings" }).click();
  await expect(page).toHaveURL(/\/#listings$/);
  await page.reload();
  const cardCover = page.locator("#listings").getByRole("img", { name: alt });
  await cardCover.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      cardCover.evaluate((node: HTMLImageElement) => node.naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(new URL((await cardCover.getAttribute("src"))!).pathname).toBe(
    replacementUrl.pathname,
  );
  // Add two real rows to the isolated test inventory for the browse screenshots.
  await createCar(
    request,
    { make: "Toyota", price: 22400, milage: 48000 },
    "RAV4 Hybrid",
  );
  const audi = await createCar(
    request,
    { make: "Audi", price: 69500, milage: 26500 },
    "RS6 Avant",
  );
  const audiUpload = await request.put(API + "/cars/" + audi.id + "/photo", {
    headers: { Authorization: "Bearer " + token },
    multipart: {
      photo: {
        name: "audi-rs6.jpg",
        mimeType: "image/jpeg",
        buffer: await readFile("public/images/audi-rs6.jpg"),
      },
    },
  });
  expect(audiUpload.ok()).toBe(true);
  await page.goto("/");
  const audiCover = page.getByRole("img", {
    name: "Cover photo of Audi RS6 Avant",
  });
  await audiCover.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      audiCover.evaluate((node: HTMLImageElement) => node.naturalWidth),
    )
    .toBeGreaterThan(0);
  await cardCover.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("card-cover.png"),
    fullPage: true,
    style: screenshotStyle,
  });
});
