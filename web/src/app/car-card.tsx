import Link from "next/link";
import { money, type Car } from "./cars";
import { FavoriteButton } from "./favorite-button";
import { VehicleCover } from "./vehicle-cover";

export function CarCard({
  car,
  onRemoved,
  heading: Heading = "h3",
}: {
  car: Car;
  onRemoved?: () => void;
  heading?: "h2" | "h3";
}) {
  const name = `${car.make} ${car.model}`;
  return (
    <article className="car-card">
      <Link
        href={`/cars/${car.id}`}
        prefetch={false}
        className="card-photo"
        aria-label={`View ${name}`}
      >
        <VehicleCover
          car={car}
          sizes="(max-width: 600px) 100vw, (max-width: 930px) 50vw, 33vw"
        />
      </Link>
      <div className="card-body">
        <div className="card-price">{money(car.price)}</div>
        <Heading>
          <Link href={`/cars/${car.id}`} prefetch={false}>
            {name}
          </Link>
        </Heading>
        <p className="card-specs">
          {car.year} <span aria-hidden="true">·</span>{" "}
          {car.milage.toLocaleString("en-US")} km
        </p>
        <FavoriteButton carId={car.id} onRemoved={onRemoved} />
      </div>
    </article>
  );
}
