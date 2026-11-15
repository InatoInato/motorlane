import { expect, test } from "@playwright/test";
import { carRequest, getCars, isCar, PAGE_SIZE } from "../../src/app/cars";

const car = {
  id: 1,
  make: "BMW",
  model: "320i",
  year: 2021,
  price: 28000,
  milage: 45000,
};
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function reply(body: unknown, status = 200) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
}

test("accepts an API car, including zero price and mileage", () => {
  expect(isCar(car)).toBe(true);
  expect(isCar({ ...car, price: 0, milage: 0 })).toBe(true);
});

for (const [name, value] of [
  ["null", null],
  ["array", []],
  ["missing model", { ...car, model: undefined }],
  ["blank make", { ...car, make: "  " }],
  ["string price", { ...car, price: "28000" }],
  ["fractional mileage", { ...car, milage: 1.5 }],
  ["negative price", { ...car, price: -1 }],
  ["invalid ID", { ...car, id: 0 }],
] as const) {
  test(`rejects untrusted car data: ${name}`, () => {
    expect(isCar(value)).toBe(false);
  });
}

test("keeps pagination bounded and detects the next page", async () => {
  let requested = "";
  globalThis.fetch = async (url) => {
    requested = String(url);
    return Response.json(
      Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ ...car, id: i + 1 })),
    );
  };
  const result = await getCars(24);
  expect(requested).toMatch(/\/cars\?limit=13&offset=24$/);
  expect(result.cars).toHaveLength(PAGE_SIZE);
  expect(result.hasMore).toBe(true);
});

test("recognizes an empty or final inventory page", async () => {
  reply([]);
  expect(await getCars(0)).toEqual({ cars: [], hasMore: false });
  reply([car]);
  expect(await getCars(0)).toEqual({ cars: [car], hasMore: false });
});

for (const [name, body] of [
  ["unexpected object", { cars: [car] }],
  ["malformed row", [{ ...car, price: null }]],
  ["oversized response", Array.from({ length: PAGE_SIZE + 2 }, () => car)],
] as const) {
  test(`does not display a broken inventory: ${name}`, async () => {
    reply(body);
    await expect(getCars(0)).rejects.toThrow("The listings couldn't be read");
  });
}

test("rejects invalid JSON from the API", async () => {
  globalThis.fetch = async () => new Response("not JSON");
  await expect(getCars(0)).rejects.toThrow("The listings couldn't be read");
});

for (const [status, message] of [
  [404, "no longer available"],
  [422, "Check the name"],
  [500, "Something went wrong"],
] as const) {
  test(`returns a useful error for HTTP ${status}`, async () => {
    reply({ detail: "Internal diagnostic not for display" }, status);
    await expect(carRequest("/cars/1")).rejects.toThrow(message);
  });
}

test("accepts the empty successful DELETE response", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  expect(await carRequest("/cars/1", { method: "DELETE" })).toBeNull();
});

test("distinguishes a failed read from an unconfirmed write, without retrying writes", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new TypeError("Failed to fetch");
  };
  await expect(carRequest("/cars")).rejects.toThrow(
    "couldn't reach the marketplace",
  );
  calls = 0;
  await expect(
    carRequest("/cars", { method: "POST", body: "{}" }),
  ).rejects.toThrow("Check the listings before trying again");
  expect(calls).toBe(1);
});
