import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  // Both viewports share one disposable database; keep their writes sequential.
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      name: "Test API",
      cwd: path.resolve(__dirname, "../api"),
      command:
        "uv run python -m app.photo_storage && uv run alembic upgrade head && uv run uvicorn app.main:app --host 127.0.0.1 --port 8001",
      // Wait for a database query, not just a running process.
      url: "http://localhost:8001/cars?limit=1",
      env: {
        DATABASE_URL:
          "postgresql+psycopg://motorlane:motorlane@localhost:5434/motorlane_test",
        AWS_ACCESS_KEY_ID: "motorlane-test",
        AWS_SECRET_ACCESS_KEY: "motorlane-test",
        AWS_DEFAULT_REGION: "us-east-1",
        S3_PHOTO_BUCKET: "motorlane-browser-test",
        S3_ENDPOINT_URL: "http://localhost:5001",
        S3_PUBLIC_ENDPOINT_URL: "http://localhost:5001",
        WEB_ORIGIN: "http://localhost:3100",
      },
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
    {
      name: "Test web",
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://localhost:3100",
      env: { NEXT_PUBLIC_API_URL: "http://localhost:8001", NEXT_DIST_DIR: ".next-e2e" },
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
  ],
});
