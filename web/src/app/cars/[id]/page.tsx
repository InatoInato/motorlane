import Link from "next/link";
import { carRequest, isCar, type Car } from "../../cars";
import { ListingDetails } from "./listing-details";

export default async function CarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let car: Car | undefined;
  let error = "This car is no longer available.";
  if (/^[1-9][0-9]{0,9}$/.test(id) && Number(id) <= 2147483647) {
    try {
      const listing = await carRequest("/cars/" + id);
      if (isCar(listing)) car = listing;
      else error = "We couldn't read this listing. Please try again.";
    } catch (cause) {
      if (cause instanceof Error) error = cause.message;
    }
  }

  if (car) return <ListingDetails car={car} />;
  return (
    <main className="shell subpage" id="main-content">
      <div className="empty-state" role="alert">
        <h1>Listing unavailable</h1>
        <p>{error}</p>
        <Link className="button secondary" href="/#listings">
          Back to listings
        </Link>
      </div>
    </main>
  );
}
