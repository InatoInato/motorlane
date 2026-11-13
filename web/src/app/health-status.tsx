"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "connected" | "unavailable";

export function HealthStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    let active = true;

    async function checkHealth() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const response = await fetch(`${baseUrl}/health`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Health request failed");

        const body: unknown = await response.json();
        if (
          typeof body !== "object" ||
          body === null ||
          !("status" in body) ||
          body.status !== "ok"
        ) {
          throw new Error("Unexpected health response");
        }
        if (active) setStatus("connected");
      } catch {
        if (active) setStatus("unavailable");
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void checkHealth();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const messages: Record<Status, string> = {
    checking: "Checking the connection…",
    connected: "API connected. Both applications are running.",
    unavailable: "The API is unavailable. Start it and reload this page.",
  };

  return <p role="status" data-status={status}>{messages[status]}</p>;
}
