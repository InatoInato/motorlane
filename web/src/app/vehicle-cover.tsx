"use client";

import Image from "next/image";
import { useState } from "react";
import type { Car } from "./cars";

export function VehicleCover({
  car,
  sizes,
  eager,
}: {
  car: Car;
  sizes: string;
  eager?: boolean;
}) {
  return <Cover key={car.photo_url} car={car} sizes={sizes} eager={eager} />;
}

function Cover({
  car,
  sizes,
  eager,
}: {
  car: Car;
  sizes: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (car.photo_url && !failed) {
    return (
      <Image
        src={car.photo_url}
        alt={`Cover photo of ${car.make} ${car.model}`}
        sizes={sizes}
        fill
        unoptimized
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="no-photo">
      <svg viewBox="0 0 120 44" fill="none" aria-hidden="true">
        <path
          d="M8 32v-9l15-5L37 7h38l20 14 16 5v6h-11m-17 0H37m-17 0H8m16-14h68M53 8l-2 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="28" cy="32" r="8" stroke="currentColor" strokeWidth="2" />
        <circle cx="92" cy="32" r="8" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>{failed ? "Cover photo unavailable" : "No vehicle photo yet"}</span>
    </div>
  );
}
