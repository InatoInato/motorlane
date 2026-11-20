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
let token: string;
let username: string;

test.beforeEach(async ({ request }) => {
  prefix = `web-test-${randomUUID().slice(0, 8)}`;
  username = `seller_${randomUUID().slice(0, 8)}`;
  const data = { username, password: "test-password-123" };
  await request.post(`${API}/auth/register`, { data });
  token = (await (await request.post(`${API}/auth/login`, { data })).json()).token;
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
    const deleted = await request.delete(`${API}/cars/${car.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(deleted.status()).toBe(204);
  }
});

async function createCar(
  request: APIRequestContext,
  changes: Partial<CarInput> = {},
) {
  const response = await request.post(`${API}/cars`, {
    headers: { Authorization: `Bearer ${token}` },
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel(`Account: ${username}`, { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel(`Account: ${username}`, { exact: true })).toBeVisible();
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
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel(`Account: ${username}`, { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel(`Account: ${username}`, { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel(`Account: ${username}`, { exact: true })).toBeVisible();
  expect((await request.delete(`${API}/cars/${car.id}`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(204);
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel(`Account: ${username}`, { exact: true })).toBeVisible();
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

test("registers in a modal, reports errors and signs out", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByLabel("Username", { exact: true })).toHaveCount(0);
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  await signIn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Sign in");
  await expect(dialog.getByText("8–128 characters.", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog.getByLabel("Password", { exact: true }).fill("wrong-password-123");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("valid username and password");
  await expect(dialog.getByLabel("Username", { exact: true })).toHaveValue(username);
  await dialog.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Create account");
  await expect(dialog.getByText("8–128 characters.", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await dialog.getByLabel("Password", { exact: true }).fill("test-password-123");
  await dialog.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("already taken");
  const password = dialog.getByLabel("Password", { exact: true });
  await password.fill("1234567");
  expect(await password.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
  await password.fill("12345678");
  expect(await password.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true);
  const newUser = `new_${randomUUID().slice(0, 8)}`;
  await dialog.getByLabel("Username", { exact: true }).fill(newUser);
  await dialog.getByRole("button", { name: "Show password" }).click();
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await dialog.getByRole("button", { name: "Hide password" }).click();
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await page.screenshot({ path: testInfo.outputPath("registration.png") });
  await dialog.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const account = page.getByLabel(`Account: ${newUser}`, { exact: true });
  await expect(account).toBeFocused();
  await account.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(signIn).toBeFocused();
});

test("contains focus, closes on Escape and resumes selling", async ({ page }, testInfo) => {
  await page.goto("/");
  const sell = page.getByRole("button", { name: "Sell your car" }).first();
  await sell.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Sign in");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest("dialog")))).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(sell).toBeFocused();
  await sell.click();
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog.getByLabel("Password", { exact: true }).fill("test-password-123");
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("sign-in.png") });
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Make room for what's next.");
  await expect(dialog.getByLabel("Make", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sell).toBeFocused();
});

test("preserves auth input on network and server errors and prevents duplicate submissions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog.getByLabel("Password", { exact: true }).fill("test-password-123");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let submissions = 0;
  await page.route(`${API}/auth/login`, async route => {
    submissions++;
    await held;
    await route.fulfill({ status: 500, json: { detail: "Failure" } });
  });
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Please wait…" })).toBeDisabled();
  await expect(dialog.getByLabel("Username", { exact: true })).toBeDisabled();
  release();
  await expect(dialog.getByRole("alert")).toContainText("account request");
  expect(submissions).toBe(1);
  await expect(dialog.getByLabel("Username", { exact: true })).toHaveValue(username);
  await page.unroute(`${API}/auth/login`);
  await page.route(`${API}/auth/login`, route => route.abort());
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("reach your account");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("favorites prompt sign-in, sync cards and details, and support a private favorites page", async ({ page, request }, testInfo) => {
  const car = await createCar(request);
  await page.goto("/");
  const card = page.locator("#listings .car-card");
  await card.getByRole("button", { name: "Save to favorites", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Sign in");
  await dialog.getByLabel("Username", { exact: true }).fill(username);
  await dialog.getByLabel("Password", { exact: true }).fill("test-password-123");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(card.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: `View BMW ${car.model}` }).click();
  await dialog.getByRole("button", { name: "Remove from favorites" }).click();
  await expect(dialog.getByRole("button", { name: "Save to favorites" })).toHaveAttribute("aria-pressed", "false");
  await dialog.getByRole("button", { name: "Save to favorites" }).click();
  await expect(dialog.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
  await page.keyboard.press("Escape");
  let releaseFavorites!: () => void;
  const heldFavorites = new Promise<void>(resolve => { releaseFavorites = resolve; });
  await page.route(`${API}/favorites?*`, async route => {
    await heldFavorites;
    await route.continue();
  });
  await page.getByRole("link", { name: "My favorites" }).click();
  try {
    await expect(page.getByRole("status")).toHaveText("Loading favorites…");
  } finally { releaseFavorites(); }
  await expect(page.getByRole("heading", { name: "My favorites" })).toBeVisible();
  await expect(page.getByRole("button", { name: `BMW ${car.model}` })).toBeVisible();
  await page.unroute(`${API}/favorites?*`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("favorites.png"), fullPage: true });
  await page.getByRole("button", { name: "Remove from favorites" }).click();
  await expect(page.getByRole("heading", { name: "No favorites on this page." })).toBeVisible();
  await page.route(`${API}/favorites?*`, route => route.fulfill({ status: 500, json: {} }));
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Browse cars", exact: true }).first().click();
  await page.getByRole("link", { name: "My favorites" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Something went wrong");
  await page.unroute(`${API}/favorites?*`);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "No favorites on this page." })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Sign in to see your saved cars.")).toBeVisible();
});
