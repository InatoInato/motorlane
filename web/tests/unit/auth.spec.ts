import { test, expect } from "@playwright/test";
import { carRequest, setAuthToken } from "../../src/app/cars";
const originalFetch = global.fetch;
test.afterEach(() => { global.fetch = originalFetch; setAuthToken(null); });
test("sends and clears session credentials", async () => {
  const headers: Headers[] = [];
  global.fetch = async (_url, options) => {
    headers.push(new Headers(options?.headers));
    return new Response("{}", { status: 200 });
  };
  setAuthToken("session-token");
  await carRequest("/auth/me");
  setAuthToken(null);
  await carRequest("/cars");
  expect(headers[0].get("Authorization")).toBe("Bearer session-token");
  expect(headers[1].has("Authorization")).toBe(false);
});
for (const status of [401, 403, 409]) {
  test(`explains auth failure ${status}`, async () => {
    global.fetch = async () => new Response("{}", { status });
    await expect(carRequest("/auth/login")).rejects.toThrow(status === 401 ? /sign in/ : status === 403 ? /seller/ : /taken/);
  });
}
