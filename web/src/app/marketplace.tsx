"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { CarCard } from "./car-card";
import type { Car } from "./cars";

type Filters = { q: string; make: string; budget: string; sort: string };
type Props = {
  cars: Car[];
  hasMore: boolean;
  error: string;
  page: number;
  filters: Filters;
};

export function Marketplace({ cars, hasMore, error, page, filters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const makes = [...new Set(cars.map((car) => car.make))].sort();
  if (filters.make && !makes.includes(filters.make)) makes.push(filters.make);
  const visible = cars
    .filter(
      (car) =>
        (!filters.make || car.make === filters.make) &&
        (!filters.q ||
          [car.make, car.model, car.year]
            .join(" ")
            .toLowerCase()
            .includes(filters.q.toLowerCase())) &&
        (!filters.budget || car.price <= Number(filters.budget)),
    )
    .sort((a, b) =>
      filters.sort === "price-low"
        ? a.price - b.price
        : filters.sort === "price-high"
          ? b.price - a.price
          : b.id - a.id,
    );
  const filtered = Boolean(filters.q || filters.make || filters.budget);

  function href(nextPage: number, nextFilters = filters) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) {
      if (value && !(key === "sort" && value === "latest"))
        params.set(key, value);
    }
    if (nextPage > 1) params.set("page", String(nextPage));
    return (params.size ? "/?" + params : "/") + "#listings";
  }

  function update(nextFilters: Filters) {
    startTransition(() => router.push(href(page, nextFilters)));
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    update({
      ...filters,
      q: String(data.get("q")).trim(),
      make: String(data.get("make")),
      budget: String(data.get("budget")),
    });
  }

  function reset() {
    update({ q: "", make: "", budget: "", sort: filters.sort });
  }

  return (
    <main className="shell home-page" id="main-content">
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="accent-line" /> The car marketplace
          </p>
          <h1 id="hero-heading">
            Find your
            <br /> next drive<span>.</span>
          </h1>
          <p className="hero-intro">
            Browse pre-owned cars, save the ones you like and list a car of your
            own.
          </p>
        </div>
        <div className="hero-photo">
          <Image
            src="/images/porsche.jpg"
            alt="Black Porsche Panamera driving on an open road"
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 720px) 100vw, 60vw"
          />
          <span className="hero-caption">Porsche Panamera</span>
        </div>
      </section>
      <form
        className="search-bar"
        aria-label="Search listings"
        onSubmit={search}
        key={[page, filters.q, filters.make, filters.budget].join("|")}
      >
        <label className="search-field">
          <span>Make &amp; model</span>
          <div className="search-input">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="10.5"
                cy="10.5"
                r="6.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="m16 16 4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              name="q"
              aria-label="Search make or model"
              defaultValue={filters.q}
              placeholder="Try BMW or 330i"
            />
          </div>
        </label>
        <label>
          <span>Brand</span>
          <select name="make" defaultValue={filters.make}>
            <option value="">All makes</option>
            {makes.map((make) => (
              <option key={make}>{make}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Your budget</span>
          <select name="budget" defaultValue={filters.budget}>
            <option value="">Any price</option>
            {[25000, 50000, 75000, 100000].map((budget) => (
              <option key={budget} value={budget}>
                Up to {"$" + budget.toLocaleString("en-US")}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary search-button" disabled={pending}>
          {pending ? "Searching…" : "Find my car"}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <section
        className="marketplace"
        id="listings"
        aria-labelledby="listings-heading"
        aria-busy={pending}
      >
        <div className="results-toolbar">
          <div>
            <h2 id="listings-heading">Browse cars</h2>
            {!error && (
              <p>
                {visible.length} {visible.length === 1 ? "car" : "cars"} on this
                page{" "}
                {filtered && (
                  <button className="text-button clear-filters" onClick={reset}>
                    Clear filters
                  </button>
                )}
              </p>
            )}
          </div>
          <label className="sort-label">
            Sort by{" "}
            <select
              aria-label="Sort cars on this page"
              value={filters.sort}
              onChange={(event) =>
                update({ ...filters, sort: event.target.value })
              }
            >
              <option value="latest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
        </div>
        {error ? (
          <div className="empty-state" role="alert">
            <h3>Listings unavailable</h3>
            <p>{error}</p>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => startTransition(() => router.refresh())}
            >
              {pending ? "Trying again…" : "Try again"}
            </button>
          </div>
        ) : visible.length ? (
          <div className="car-grid">
            {visible.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>
              {filtered
                ? "No cars match these filters"
                : "No listings on this page"}
            </h3>
            <p>
              {filtered
                ? "Change your search or browse another page."
                : "Check back for new listings."}
            </p>
            {filtered && (
              <button className="button secondary" onClick={reset}>
                Reset filters
              </button>
            )}
          </div>
        )}
        {!error && (page > 1 || hasMore) && (
          <nav className="pagination" aria-label="Listing pages">
            {page > 1 ? (
              <Link className="button secondary" href={href(page - 1)}>
                Previous
              </Link>
            ) : (
              <button className="button secondary" disabled>
                Previous
              </button>
            )}
            <span>Page {page}</span>
            {hasMore ? (
              <Link className="button secondary" href={href(page + 1)}>
                Next
              </Link>
            ) : (
              <button className="button secondary" disabled>
                Next
              </button>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
