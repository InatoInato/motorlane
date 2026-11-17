"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "../session";
import { carRequest, isCar, PAGE_SIZE, type Car } from "../cars";
import { FavoriteButton } from "../favorite-button";
import { ListingDialog } from "../listing-dialog";
import { money } from "../cars";

export default function FavoritesPage() {
  const { account, signIn, setSaved } = useSession();
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ cars: Car[]; more: boolean } | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Car | null>(null);
  useEffect(() => {
    if (!account) return;
    let active = true;
    carRequest(`/favorites?limit=${PAGE_SIZE + 1}&offset=${offset}`).then(body => {
      if (!Array.isArray(body) || body.length > PAGE_SIZE + 1 || !body.every(isCar)) throw new Error("Couldn't read favorites. Please try again.");
      if (active) {
        setResult({ cars: body.slice(0, PAGE_SIZE), more: body.length > PAGE_SIZE });
        setError("");
        setSaved(previous => ({ ...previous, ...Object.fromEntries(body.map(car => [`${account.id}:${car.id}`, true])) }));
      }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Couldn't load favorites."); });
    return () => { active = false; };
  }, [account, offset, retry, setSaved]);
  function refresh(next = offset) { setResult(null); setError(""); setOffset(next); setRetry(retry + 1); }
  return <main className="shell favorites-page">
    <Link href="/">← Browse cars</Link>
    <h1>My favorites</h1>
    {!account ? <div className="empty-state"><p>Sign in to see your saved cars.</p><button className="button primary" onClick={() => signIn()}>Sign in</button></div>
      : error ? <div role="alert" className="empty-state"><p>{error}</p><button className="button primary" onClick={() => refresh()}>Try again</button></div>
      : !result ? <p role="status">Loading favorites…</p>
      : <>
        {result.cars.length === 0 ? <div className="empty-state"><h2>No favorites on this page.</h2><p>Save cars while browsing to find them here.</p><Link href="/">Browse cars</Link></div> : <div className="car-grid">{result.cars.map(car => <article key={car.id} className="car-card favorites-card"><h2><button className="text-button" onClick={() => setSelected(car)}>{car.make} {car.model}</button></h2><p>{car.year} · {car.milage.toLocaleString("en-US")} km</p><p>{money(car.price)}</p><FavoriteButton carId={car.id} onRemoved={() => refresh()} /></article>)}</div>}
        <nav className="pagination" aria-label="Favorite pages"><button disabled={offset === 0} onClick={() => refresh(Math.max(0, offset - PAGE_SIZE))}>Previous</button><span>Page {offset / PAGE_SIZE + 1}</span><button disabled={!result.more} onClick={() => refresh(offset + PAGE_SIZE)}>Next</button></nav>
      </>}
    {selected && <ListingDialog car={selected} userId={account?.id ?? null} onClose={() => { setSelected(null); refresh(); }} onSaved={() => { setSelected(null); refresh(); }} />}
  </main>;
}
