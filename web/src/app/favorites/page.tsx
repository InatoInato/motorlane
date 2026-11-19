"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "../session";
import { carRequest, isCar, PAGE_SIZE, type Car } from "../cars";
import { CarCard } from "../car-card";

export default function FavoritesPage() {
  const { account, signIn } = useSession();
  return (
    <main className="shell subpage favorites-page" id="main-content">
      <div className="page-heading">
        <h1>My favorites</h1>
        <p>Keep the cars you’re considering in one place.</p>
      </div>
      {!account ? (
        <div className="empty-state">
          <h2>See your saved cars</h2>
          <p>Sign in to see your saved cars.</p>
          <button className="button primary" onClick={() => signIn()}>
            Sign in
          </button>
        </div>
      ) : (
        <SavedCars key={account.id} accountId={account.id} />
      )}
    </main>
  );
}

function SavedCars({ accountId }: { accountId: number }) {
  const { setSaved } = useSession();
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ cars: Car[]; more: boolean } | null>(
    null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    carRequest(`/favorites?limit=${PAGE_SIZE + 1}&offset=${offset}`)
      .then((body) => {
        if (
          !Array.isArray(body) ||
          body.length > PAGE_SIZE + 1 ||
          !body.every(isCar)
        )
          throw new Error("Couldn't read favorites. Please try again.");
        if (active) {
          setResult({
            cars: body.slice(0, PAGE_SIZE),
            more: body.length > PAGE_SIZE,
          });
          setError("");
          setSaved((previous) => ({
            ...previous,
            ...Object.fromEntries(
              body.map((car) => [`${accountId}:${car.id}`, true]),
            ),
          }));
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Couldn't load favorites.",
          );
      });
    return () => {
      active = false;
    };
  }, [accountId, offset, retry, setSaved]);
  function refresh(next = offset) {
    setResult(null);
    setError("");
    setOffset(next);
    setRetry(retry + 1);
  }
  return error ? (
    <div role="alert" className="empty-state">
      <h2>Favorites unavailable</h2>
      <p>{error}</p>
      <button className="button secondary" onClick={() => refresh()}>
        Try again
      </button>
    </div>
  ) : !result ? (
    <p role="status">Loading favorites…</p>
  ) : (
    <>
      {result.cars.length === 0 ? (
        <div className="empty-state">
          <h2>No favorites on this page.</h2>
          <p>Save cars while browsing to find them here.</p>
          <Link className="button secondary" href="/#listings">
            Browse cars
          </Link>
        </div>
      ) : (
        <div className="car-grid">
          {result.cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              heading="h2"
              onRemoved={() => refresh()}
            />
          ))}
        </div>
      )}
      <nav className="pagination" aria-label="Favorite pages">
        <button
          className="button secondary"
          disabled={offset === 0}
          onClick={() => refresh(Math.max(0, offset - PAGE_SIZE))}
        >
          Previous
        </button>
        <span>Page {offset / PAGE_SIZE + 1}</span>
        <button
          className="button secondary"
          disabled={!result.more}
          onClick={() => refresh(offset + PAGE_SIZE)}
        >
          Next
        </button>
      </nav>
    </>
  );
}
