"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { carRequest, money, type Car } from "../../cars";
import { FavoriteButton } from "../../favorite-button";
import { ListingDialog } from "../../listing-dialog";
import { useSession } from "../../session";
import { VehicleCover } from "../../vehicle-cover";

export function ListingDetails({ car }: { car: Car }) {
  const router = useRouter();
  const { account } = useSession();
  const isSeller = account && car.owner_id === account.id;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await carRequest("/cars/" + car.id, { method: "DELETE" });
      router.replace("/#listings");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your listing couldn't be deleted.",
      );
      setDeleting(false);
    }
  }

  return (
    <main className="shell subpage details-page" id="main-content">
      <Link className="back-link" href="/#listings">
        ← Back to listings
      </Link>
      {notice && (
        <div className="notice toast" role="status">
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss listing update"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      <div className="detail-layout">
        <div className="detail-photo">
          <VehicleCover
            car={car}
            sizes="(max-width: 780px) 100vw, 66vw"
            eager
          />
        </div>
        <div className="detail-summary">
          <h1>
            {car.make} {car.model}
          </h1>
          <p className="detail-price">
            {money(car.price)} <span>USD</span>
          </p>
          <dl className="detail-specs">
            <div>
              <dt>Year</dt>
              <dd>{car.year}</dd>
            </div>
            <div>
              <dt>Mileage</dt>
              <dd>{car.milage.toLocaleString("en-US")} km</dd>
            </div>
          </dl>
          <FavoriteButton carId={car.id} />
          {isSeller && (
            <section
              className="seller-actions"
              aria-label="Manage your listing"
            >
              {confirming ? (
                <>
                  <h2>Delete this listing?</h2>
                  <p>This permanently removes the car from the marketplace.</p>
                  <div className="dialog-actions">
                    <button
                      className="button secondary"
                      disabled={deleting}
                      onClick={() => setConfirming(false)}
                    >
                      Keep listing
                    </button>
                    <button
                      className="button destructive"
                      disabled={deleting}
                      onClick={remove}
                    >
                      {deleting ? "Deleting…" : "Yes, delete listing"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditing(true);
                      setNotice("");
                    }}
                  >
                    Edit listing
                  </button>
                  <button
                    className="text-button danger"
                    onClick={() => setConfirming(true)}
                  >
                    Delete listing
                  </button>
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
      {editing && (
        <ListingDialog
          car={car}
          onClose={() => setEditing(false)}
          onChanged={() => router.refresh()}
          onSaved={(message) => {
            setEditing(false);
            setNotice(message);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}
