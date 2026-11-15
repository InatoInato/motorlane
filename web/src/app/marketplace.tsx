"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { money, photoFor, type Car } from "./cars";
import { HealthStatus } from "./health-status";
import { ListingDialog } from "./listing-dialog";

type Filters = { q: string; make: string; budget: string; sort: string };
type Props = {
  cars: Car[];
  hasMore: boolean;
  error: string;
  page: number;
  filters: Filters;
};

// Editorial examples are never written to the API or presented as live inventory.
const samples: Car[] = [
  {
    id: -1,
    make: "BMW",
    model: "3 Series",
    year: 2021,
    price: 32900,
    milage: 38000,
  },
  {
    id: -2,
    make: "Mercedes-Benz",
    model: "AMG GT",
    year: 2020,
    price: 89900,
    milage: 32000,
  },
  {
    id: -3,
    make: "Porsche",
    model: "Panamera",
    year: 2019,
    price: 68500,
    milage: 51000,
  },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function CarCard({
  car,
  sample = false,
  onOpen,
}: {
  car: Car;
  sample?: boolean;
  onOpen?: () => void;
}) {
  const photo = photoFor(car.make);
  return (
    <article className="car-card">
      <div className="card-photo">
        {photo ? (
          <Image
            src={photo}
            alt={`Illustrative ${car.make} photograph, not the listed car`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          />
        ) : (
          <div className="no-photo">
            <span className="car-outline" aria-hidden="true">
              ↗
            </span>
            <span>No vehicle photo yet</span>
          </div>
        )}
        <span className="photo-label">
          {sample
            ? "Sample vehicle"
            : photo
              ? "Illustrative photo"
              : "Photo unavailable"}
        </span>
      </div>
      <div className="card-body">
        <p className="card-year">
          {car.year} <span aria-hidden="true">/</span> {car.make}
        </p>
        <h3>
          {sample ? (
            car.model
          ) : (
            <button onClick={onOpen}>
              {car.model}
              <Arrow />
            </button>
          )}
        </h3>
        <p className="card-mileage">
          {car.milage.toLocaleString("en-US")} km{" "}
          <span aria-hidden="true">·</span> Pre-owned
        </p>
        <div className="card-bottom">
          <p className="card-price">
            {money(car.price)}
            <span>{sample ? "Example price" : "USD"}</span>
          </p>
          {!sample && (
            <button
              className="round-button"
              onClick={onOpen}
              aria-label={`View ${car.make} ${car.model}`}
            >
              <Arrow />
            </button>
          )}
          {sample && <span className="sample-caption">For inspiration</span>}
        </div>
      </div>
    </article>
  );
}

export function Marketplace({ cars, hasMore, error, page, filters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Car | "create" | null>(null);
  const [notice, setNotice] = useState("");
  const makes = [...new Set(cars.map((car) => car.make))].sort();
  if (filters.make && !makes.includes(filters.make)) makes.push(filters.make);
  const visible = cars
    .filter(
      (car) =>
        (!filters.make || car.make === filters.make) &&
        (!filters.q ||
          `${car.make} ${car.model} ${car.year}`
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
    for (const [key, value] of Object.entries(nextFilters))
      if (value && !(key === "sort" && value === "latest"))
        params.set(key, value);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `${params.size ? `/?${params}` : "/"}#listings`;
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextFilters = {
      ...filters,
      q: String(data.get("q")).trim(),
      make: String(data.get("make")),
      budget: String(data.get("budget")),
    };
    startTransition(() =>
      router.push(href(page, nextFilters), { scroll: false }),
    );
    document
      .getElementById("listings")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saved(message: string) {
    setDialog(null);
    setNotice(message);
    startTransition(() => {
      router.push("/#listings", { scroll: false });
      router.refresh();
    });
  }

  return (
    <>
      <a className="skip-link" href="#listings">
        Skip to cars
      </a>
      <header className="site-header shell">
        <Link className="wordmark" href="/" aria-label="Motorlane home">
          <svg
            width="24"
            height="28"
            viewBox="0 0 24 28"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 26 11 2h5L7 26H2Zm10 0L21 2"
              stroke="currentColor"
              strokeWidth="2.5"
            />
          </svg>
          motorlane<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <a className="nav-active" href="#listings">
            Browse cars
          </a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <button
          className="button primary sell-button"
          onClick={() => setDialog("create")}
        >
          Sell your car <Arrow />
        </button>
      </header>
      <main>
        <section className="hero shell" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="little-line" />
              FOR THE LOVE OF THE DRIVE
            </p>
            <h1 id="hero-heading">
              Your next
              <br />
              chapter.
              <br />
              <span>Your next car.</span>
            </h1>
            <p className="hero-intro">
              Some cars just feel right.
              <br /> Find the one that moves you.
            </p>
            <a className="hero-link" href="#listings">
              Explore the marketplace <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero-photo">
            <Image
              src="/images/porsche.jpg"
              alt="A black Porsche Panamera on the open road"
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(max-width: 700px) 100vw, 60vw"
            />
            <span className="hero-photo-tag">
              A NEW PERSPECTIVE ON PRE-OWNED.
            </span>
            <div className="hero-caption">
              <span>Built for the road ahead.</span>
              <span aria-hidden="true">↗</span>
            </div>
          </div>
        </section>

        <section
          className="marketplace shell"
          id="listings"
          aria-labelledby="listings-heading"
          aria-busy={pending}
        >
          <div className="section-title">
            <div>
              <p className="eyebrow">THE MARKETPLACE</p>
              <h2 id="listings-heading">Find your kind of drive.</h2>
            </div>
            <p className="section-aside">A fresh start is a few clicks away.</p>
          </div>
          <form
            className="search-bar"
            onSubmit={search}
            key={`${page}-${filters.q}-${filters.make}-${filters.budget}`}
          >
            <label className="search-field">
              <span>Make & model</span>
              <div>
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
                    strokeWidth="1.7"
                  />
                  <path
                    d="m16 16 4 4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>
                <input
                  name="q"
                  aria-label="Search make or model"
                  defaultValue={filters.q}
                  placeholder="What moves you?"
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
                <option value="25000">Up to $25,000</option>
                <option value="50000">Up to $50,000</option>
                <option value="75000">Up to $75,000</option>
                <option value="100000">Up to $100,000</option>
              </select>
            </label>
            <button
              className="button primary search-button"
              type="submit"
              disabled={pending}
            >
              {pending ? "Searching…" : "Find my car"}
              <Arrow />
            </button>
          </form>

          <div className="results-toolbar">
            <p>
              <strong>
                {error
                  ? "Listings unavailable"
                  : `${visible.length} ${visible.length === 1 ? "car" : "cars"}`}
              </strong>
              {!error && <span> on this page</span>}
              {filtered && (
                <button
                  className="text-button clear-filters"
                  onClick={() =>
                    startTransition(() =>
                      router.push(
                        href(page, {
                          q: "",
                          make: "",
                          budget: "",
                          sort: filters.sort,
                        }),
                        { scroll: false },
                      ),
                    )
                  }
                >
                  Clear filters ×
                </button>
              )}
            </p>
            <label className="sort-label">
              Sort by{" "}
              <select
                aria-label="Sort cars on this page"
                value={filters.sort}
                onChange={(event) =>
                  startTransition(() =>
                    router.push(
                      href(page, { ...filters, sort: event.target.value }),
                      { scroll: false },
                    ),
                  )
                }
              >
                <option value="latest">Newest on page</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </label>
          </div>
          <p className="filter-note">
            Search, filters and sorting apply to this page. Browse the next page
            for more cars.
          </p>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                className="icon-button"
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}
          {error ? (
            <div className="empty-state error-state" role="alert">
              <h3>A small detour.</h3>
              <p>{error}</p>
              <button
                className="button primary"
                disabled={pending}
                onClick={() => startTransition(() => router.refresh())}
              >
                {pending ? "Trying again…" : "Try again"} <Arrow />
              </button>
            </div>
          ) : visible.length > 0 ? (
            <div className="car-grid">
              {visible.map((car) => (
                <CarCard key={car.id} car={car} onOpen={() => setDialog(car)} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <h3>
                  {filtered
                    ? "A different route, perhaps?"
                    : page > 1
                      ? "You've reached the end of the road."
                      : "Every great drive starts somewhere."}
                </h3>
                <p>
                  {filtered
                    ? "No cars on this page match your search. Adjust your filters or try another page."
                    : page > 1
                      ? "Go back a page to see the available cars."
                      : "No live listings yet. Be the first to put your car on Motorlane."}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() =>
                  filtered
                    ? startTransition(() =>
                        router.push(
                          href(page, {
                            q: "",
                            make: "",
                            budget: "",
                            sort: "latest",
                          }),
                          { scroll: false },
                        ),
                      )
                    : setDialog("create")
                }
              >
                {filtered ? "Reset filters" : "List your car"}
                <Arrow />
              </button>
            </div>
          )}
          {!error && (page > 1 || hasMore) && (
            <nav className="pagination" aria-label="Listing pages">
              <Link
                aria-disabled={page === 1}
                tabIndex={page === 1 ? -1 : undefined}
                href={href(Math.max(1, page - 1))}
              >
                ← Previous
              </Link>
              <span>Page {page}</span>
              {hasMore ? (
                <Link href={href(page + 1)}>Next page →</Link>
              ) : (
                <span className="disabled-page">Next page →</span>
              )}
            </nav>
          )}
          {!error && cars.length > 0 && (
            <p className="inventory-note">
              Photos are illustrative. Vehicle photos and locations haven’t been
              added yet.
            </p>
          )}
        </section>

        {!error && cars.length === 0 && page === 1 && !filtered && (
          <section
            className="inspiration shell"
            aria-labelledby="inspiration-heading"
          >
            <div className="inspiration-title">
              <div>
                <h2 id="inspiration-heading">A little inspiration.</h2>
                <p>Different cars. One thing in common: the joy of driving.</p>
              </div>
              <span className="outline-tag">
                SAMPLE COLLECTION · NOT FOR SALE
              </span>
            </div>
            <div className="car-grid">
              {samples.map((car) => (
                <CarCard key={car.id} car={car} sample />
              ))}
            </div>
            <p className="inventory-note">
              Sample vehicles and example prices. Photos illustrate the brand,
              not an actual listing.
            </p>
          </section>
        )}

        <section
          className="how-section shell"
          id="how-it-works"
          aria-labelledby="how-heading"
        >
          <div className="how-heading">
            <p className="eyebrow">LESS FRICTION. MORE OPEN ROAD.</p>
            <h2 id="how-heading">
              A simpler way
              <br /> to move forward.
            </h2>
          </div>
          <div className="how-step">
            <span>01</span>
            <h3>Find your fit.</h3>
            <p>
              Explore cars, narrow your search, and take a closer look at the
              details.
            </p>
          </div>
          <div className="how-step">
            <span>02</span>
            <h3>Start a new chapter.</h3>
            <p>
              Ready for a change? Create your listing and keep its details up to
              date.
            </p>
            <button className="text-button" onClick={() => setDialog("create")}>
              List your car <Arrow />
            </button>
          </div>
        </section>
        <section className="seller-banner shell">
          <div>
            <p className="eyebrow">ON TO THE NEXT ADVENTURE</p>
            <h2>Your car. Someone’s next chapter.</h2>
            <p>
              Give your car a fresh start. Create a listing in a few simple
              steps.
            </p>
          </div>
          <button
            className="button primary"
            onClick={() => setDialog("create")}
          >
            Sell your car <Arrow />
          </button>
        </section>
      </main>
      <footer className="site-footer shell">
        <div>
          <Link className="wordmark" href="/">
            motorlane<span className="brand-dot">.</span>
          </Link>
          <p>For wherever life takes you next.</p>
        </div>
        <div className="footer-right">
          <HealthStatus key={error ? "unavailable" : "available"} />
          <p>© {new Date().getFullYear()} Motorlane · Made for the drive.</p>
        </div>
      </footer>
      {dialog && (
        <ListingDialog
          key={dialog === "create" ? "create" : dialog.id}
          car={dialog === "create" ? undefined : dialog}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
