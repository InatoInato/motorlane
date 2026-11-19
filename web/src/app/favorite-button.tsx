"use client";

import { useEffect, useState } from "react";
import { carRequest } from "./cars";
import { useSession } from "./session";

export function FavoriteButton({
  carId,
  onRemoved,
}: {
  carId: number;
  onRemoved?: () => void;
}) {
  const { account, saved, setSaved, signIn } = useSession();
  const key = `${account?.id}:${carId}`;
  const value = saved[key];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!account || value !== undefined) return;
    let active = true;
    carRequest(`/favorites/${carId}`)
      .then((body) => {
        if (
          !body ||
          typeof body !== "object" ||
          !("saved" in body) ||
          typeof body.saved !== "boolean"
        )
          throw new Error("Invalid favorite status");
        const status = body.saved;
        if (active) {
          setSaved((previous) => ({ ...previous, [key]: status }));
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Couldn't load favorite. Try again.");
      });
    return () => {
      active = false;
    };
  }, [account, carId, key, value, setSaved, retry]);
  async function toggle() {
    if (!account) {
      signIn({ carId });
      return;
    }
    if (value === undefined) {
      setError("");
      setRetry(retry + 1);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await carRequest(`/favorites/${carId}`, {
        method: value ? "DELETE" : "PUT",
      });
      setSaved((previous) => ({ ...previous, [key]: !value }));
      if (value) onRemoved?.();
    } catch {
      setError("Couldn't update favorite. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="favorite-control">
      <button
        type="button"
        className="text-button favorite-button"
        aria-label={value ? "Remove from favorites" : "Save to favorites"}
        aria-pressed={value ?? false}
        disabled={busy || Boolean(account && value === undefined && !error)}
        onClick={toggle}
      >
        <span aria-hidden="true">{value ? "♥" : "♡"}</span>{" "}
        {busy
          ? "Saving…"
          : account && value === undefined && !error
            ? "Loading…"
            : value
              ? "Saved"
              : "Save"}
      </button>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
