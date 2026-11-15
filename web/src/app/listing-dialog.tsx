"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  carRequest,
  isCar,
  money,
  photoFor,
  type Car,
  type CarInput,
} from "./cars";

type Props = {
  car?: Car;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export function ListingDialog({ car, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">(
    car ? "view" : "create",
  );
  const [details, setDetails] = useState(car);
  const [loading, setLoading] = useState(Boolean(car));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const previous = document.activeElement;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal?.showModal();
    return () => {
      modal?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (!car) return;
    let active = true;
    // Read the individual endpoint so the detail view uses current car data.
    carRequest(`/cars/${car.id}`)
      .then((body) => {
        if (!isCar(body))
          throw new Error(
            "This listing couldn't be read. Please refresh the listings.",
          );
        if (active) setDetails(body);
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [car]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const payload: CarInput = {
      make: String(form.get("make")).trim(),
      model: String(form.get("model")).trim(),
      year: Number(form.get("year")),
      price: Number(form.get("price")),
      milage: Number(form.get("milage")),
    };
    setSaving(true);
    setError("");
    try {
      const body = await carRequest(
        mode === "edit" && details ? `/cars/${details.id}` : "/cars",
        {
          method: mode === "edit" ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      if (!isCar(body))
        throw new Error(
          "We couldn't confirm the saved listing. Refresh before trying again.",
        );
      onSaved(
        mode === "edit"
          ? "Listing updated. Looking good."
          : "Your car is listed. Let the next chapter begin.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your listing couldn't be saved.",
      );
      setSaving(false);
    }
  }

  async function remove() {
    if (!details || saving) return;
    setSaving(true);
    setError("");
    try {
      await carRequest(`/cars/${details.id}`, { method: "DELETE" });
      onSaved("Listing deleted.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your listing couldn't be deleted.",
      );
      setSaving(false);
    }
  }

  const title =
    mode === "create"
      ? "Make room for what's next."
      : mode === "edit"
        ? "A few finishing touches."
        : `${details?.make} ${details?.model}`;
  const photo = details ? photoFor(details.make) : null;
  return (
    <dialog
      ref={dialog}
      className="listing-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <div className="dialog-topline">
        <span className="eyebrow">
          {mode === "create"
            ? "SELL YOUR CAR"
            : mode === "edit"
              ? "EDIT LISTING"
              : "TAKE A CLOSER LOOK"}
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          disabled={saving}
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>
      <h2 id="dialog-title">{title}</h2>
      {mode === "view" ? (
        <>
          <div className="detail-photo">
            {photo ? (
              <Image
                src={photo}
                alt={`Illustrative ${details?.make} photograph, not the listed car`}
                fill
                sizes="600px"
              />
            ) : (
              <div className="no-photo">
                <span className="car-outline" aria-hidden="true">
                  ↗
                </span>
                <span>No vehicle photo yet</span>
              </div>
            )}
            {photo && <span className="photo-label">Illustrative photo</span>}
          </div>
          {loading ? (
            <p className="dialog-status" role="status">
              Getting the latest details…
            </p>
          ) : (
            <>
              <div className="detail-price">
                {money(details?.price ?? 0)} <span>USD</span>
              </div>
              <dl className="detail-specs">
                <div>
                  <dt>Year</dt>
                  <dd>{details?.year}</dd>
                </div>
                <div>
                  <dt>Mileage</dt>
                  <dd>{details?.milage.toLocaleString("en-US")} km</dd>
                </div>
                <div>
                  <dt>Listing</dt>
                  <dd>#{details?.id}</dd>
                </div>
              </dl>
              <p className="fine-print">
                Vehicle photos and seller contact details aren’t available yet.
                This local marketplace lets you manage listings.
              </p>
              {!error && !confirmDelete && (
                <div className="dialog-actions">
                  <button
                    className="button primary"
                    onClick={() => setMode("edit")}
                  >
                    Edit listing <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    className="text-button danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete listing
                  </button>
                </div>
              )}
              {confirmDelete && (
                <div className="delete-confirm">
                  <h3>Delete this listing?</h3>
                  <p>This permanently removes the car from the marketplace.</p>
                  <div className="dialog-actions">
                    <button
                      className="button destructive"
                      onClick={remove}
                      disabled={saving}
                    >
                      {saving ? "Deleting…" : "Yes, delete listing"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setConfirmDelete(false)}
                      disabled={saving}
                    >
                      Keep listing
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <p className="dialog-intro">
            {mode === "create"
              ? "Start with the essentials. A great drive deserves its next driver."
              : "Keep your car's details up to date. All fields are required."}
          </p>
          <form onSubmit={save} className="car-form">
            <fieldset disabled={saving}>
              <div className="form-pair">
                <label>
                  Make
                  <input
                    name="make"
                    placeholder="e.g. BMW"
                    maxLength={80}
                    required
                    pattern=".*\S.*"
                    defaultValue={mode === "edit" ? details?.make : ""}
                  />
                </label>
                <label>
                  Model
                  <input
                    name="model"
                    placeholder="e.g. 320i"
                    maxLength={80}
                    required
                    pattern=".*\S.*"
                    defaultValue={mode === "edit" ? details?.model : ""}
                  />
                </label>
              </div>
              <label>
                Year
                <input
                  name="year"
                  type="number"
                  min={1886}
                  max={2100}
                  step={1}
                  placeholder="e.g. 2021"
                  required
                  defaultValue={mode === "edit" ? details?.year : ""}
                />
              </label>
              <div className="form-pair">
                <label>
                  Price <span>(USD)</span>
                  <input
                    name="price"
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                    placeholder="e.g. 28000"
                    required
                    defaultValue={mode === "edit" ? details?.price : ""}
                  />
                </label>
                <label>
                  Mileage <span>(km)</span>
                  <input
                    name="milage"
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                    placeholder="e.g. 45000"
                    required
                    defaultValue={mode === "edit" ? details?.milage : ""}
                  />
                </label>
              </div>
            </fieldset>
            <p className="fine-print">
              All fields required. Prices use whole US dollars. Listings can be
              edited or removed by anyone in this local preview.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="button primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : mode === "edit"
                    ? "Save changes"
                    : "Publish listing"}
                <span aria-hidden="true">↗</span>
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
      {mode === "view" && error && (
        <div className="form-error" role="alert">
          <p>{error}</p>
          <button className="text-button" onClick={onClose}>
            Back to listings
          </button>
        </div>
      )}
    </dialog>
  );
}
