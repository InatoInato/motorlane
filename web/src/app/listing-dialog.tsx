"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { carRequest, isCar, type Car, type CarInput } from "./cars";
import { VehicleCover } from "./vehicle-cover";

const photoTypes = "image/jpeg,image/png,image/webp";

type Props = {
  car?: Car;
  onClose: () => void;
  onSaved: (message: string) => void;
  onChanged: () => void;
};

export function ListingDialog({ car, onClose, onSaved, onChanged }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestActive = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [persisted, setPersisted] = useState<Car | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "uploading">("idle");
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const busy = phase !== "idle";

  useEffect(() => {
    const previous = document.activeElement;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal?.showModal();
    return () => {
      modal?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function choose(nextFile?: File) {
    if (!nextFile || requestActive.current) return;
    if (
      !photoTypes.split(",").includes(nextFile.type) ||
      nextFile.size === 0 ||
      nextFile.size > 5 * 1024 * 1024
    ) {
      setFile(null);
      setPreview("");
      setPhotoError("Choose a JPEG, PNG or WebP image no larger than 5 MB.");
      return;
    }
    setPhotoError("");
    setPreview(URL.createObjectURL(nextFile));
    setFile(nextFile);
  }

  async function upload(listing: Car, cover: File) {
    setPhase("uploading");
    setPhotoError("");
    const data = new FormData();
    data.set("photo", cover);
    try {
      const body = await carRequest("/cars/" + listing.id + "/photo", {
        method: "PUT",
        body: data,
      });
      if (!isCar(body) || !body.photo_url)
        throw new Error("We couldn't confirm the cover upload. Try again.");
      onSaved(
        car
          ? "Listing updated and cover photo saved."
          : "Listing published with its cover photo.",
      );
    } catch (cause) {
      setPhotoError(
        cause instanceof Error
          ? cause.message
          : "Couldn't upload the cover. Try again.",
      );
      onChanged();
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestActive.current) return;
    requestActive.current = true;
    setError("");
    try {
      // A confirmed listing write supplies the ID for every photo retry.
      if (persisted) {
        if (file) await upload(persisted, file);
        return;
      }
      setPhase("saving");
      const form = new FormData(event.currentTarget);
      const payload: CarInput = {
        make: String(form.get("make")).trim(),
        model: String(form.get("model")).trim(),
        year: Number(form.get("year")),
        price: Number(form.get("price")),
        milage: Number(form.get("milage")),
      };
      const body = await carRequest(car ? "/cars/" + car.id : "/cars", {
        method: car ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      if (!isCar(body))
        throw new Error(
          "We couldn't confirm the saved listing. Refresh before trying again.",
        );
      if (file) {
        setPersisted(body);
        await upload(body, file);
      } else {
        onSaved(car ? "Listing updated." : "Listing published.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your listing couldn't be saved.",
      );
    } finally {
      requestActive.current = false;
      setPhase("idle");
    }
  }

  const current = persisted ?? car;
  return (
    <dialog
      ref={dialog}
      className="listing-dialog seller-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!requestActive.current) onClose();
      }}
    >
      <div className="dialog-topline">
        <span className="eyebrow">Seller tools</span>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>
      <h2 id="dialog-title">{car ? "Edit listing" : "List your car"}</h2>
      <p className="dialog-intro">
        {car
          ? "Update your vehicle details or replace its cover."
          : "Add your vehicle details and a cover photo to publish on Motorlane."}
      </p>
      <form onSubmit={save} className="car-form" aria-busy={busy}>
        <fieldset
          className="vehicle-fields"
          disabled={busy || Boolean(persisted)}
        >
          <legend>Vehicle details</legend>
          <div className="form-pair">
            <label>
              Make
              <input
                name="make"
                placeholder="e.g. BMW"
                maxLength={80}
                required
                pattern=".*\S.*"
                defaultValue={car?.make}
              />
            </label>
            <label>
              Model
              <input
                name="model"
                placeholder="e.g. 330i"
                maxLength={80}
                required
                pattern=".*\S.*"
                defaultValue={car?.model}
              />
            </label>
          </div>
          <div className="form-pair specs-fields">
            <label>
              Year
              <input
                name="year"
                type="number"
                min={1886}
                max={2100}
                step={1}
                placeholder="2021"
                required
                defaultValue={car?.year}
              />
            </label>
            <label>
              Price (USD)
              <input
                name="price"
                type="number"
                min={0}
                max={2147483647}
                step={1}
                placeholder="28000"
                required
                defaultValue={car?.price}
              />
            </label>
            <label>
              Mileage (km)
              <input
                name="milage"
                type="number"
                min={0}
                max={2147483647}
                step={1}
                placeholder="45000"
                required
                defaultValue={car?.milage}
              />
            </label>
          </div>
        </fieldset>
        <fieldset disabled={busy} className="photo-fields">
          <legend>
            Cover photo <span>Optional</span>
          </legend>
          <div
            className="picker-layout"
            data-has-current={Boolean(current?.photo_url)}
          >
            {current?.photo_url && (
              <div className="picker-current">
                <div className="picker-image">
                  <VehicleCover car={current} sizes="240px" />
                </div>
                <p>Current cover</p>
              </div>
            )}
            <div
              className="photo-picker"
              data-dragging={dragging}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                choose(event.dataTransfer.files[0]);
              }}
            >
              {file && preview && (
                <div className="picker-image">
                  <Image
                    src={preview}
                    alt="Selected cover preview"
                    unoptimized
                    fill
                    sizes="360px"
                  />
                </div>
              )}
              <div className="picker-controls">
                {file ? (
                  <p className="file-name">{file.name}</p>
                ) : (
                  <p className="drop-label">Drag and drop a photo</p>
                )}
                <input
                  ref={fileInput}
                  id="cover-photo"
                  name="photo"
                  type="file"
                  accept={photoTypes}
                  aria-label="Cover photo"
                  aria-describedby="cover-formats"
                  hidden
                  onChange={(event) => {
                    choose(event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => fileInput.current?.click()}
                  aria-describedby="cover-formats"
                >
                  {file ? "Choose another photo" : "Choose photo"}
                </button>
                {(file || photoError) && !persisted && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setFile(null);
                      setPreview("");
                      setPhotoError("");
                    }}
                  >
                    Remove selection
                  </button>
                )}
                <p id="cover-formats" className="auth-hint">
                  JPEG, PNG or WebP · 5 MB max
                </p>
              </div>
            </div>
          </div>
        </fieldset>
        {persisted && (
          <p className="dialog-status" role="status">
            {phase === "uploading"
              ? "Listing saved. Uploading cover…"
              : "Listing saved. You can retry the cover upload here."}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {photoError && (
          <p className="form-error" role="alert">
            {photoError}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            {persisted ? "Done" : "Cancel"}
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={
              busy ||
              Boolean(persisted && !file) ||
              Boolean(photoError && !file)
            }
          >
            {phase === "uploading"
              ? "Uploading…"
              : phase === "saving"
                ? "Saving…"
                : persisted
                  ? "Retry photo upload"
                  : car
                    ? "Save changes"
                    : "Publish listing"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
