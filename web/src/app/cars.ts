export type CarInput = {
  make: string;
  model: string;
  year: number;
  price: number;
  milage: number;
};

export type Car = CarInput & { id: number };
export const PAGE_SIZE = 12;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function isCar(value: unknown): value is Car {
  if (typeof value !== "object" || value === null) return false;
  const car = value as Record<string, unknown>;
  return (
    typeof car.make === "string" &&
    car.make.trim().length > 0 &&
    typeof car.model === "string" &&
    car.model.trim().length > 0 &&
    ["id", "year", "price", "milage"].every(
      (field) =>
        typeof car[field] === "number" && Number.isSafeInteger(car[field]),
    ) &&
    Number(car.id) > 0 &&
    Number(car.price) >= 0 &&
    Number(car.milage) >= 0
  );
}

export async function carRequest(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error(
      options.method && options.method !== "GET"
        ? "We couldn't confirm your changes. Check the listings before trying again."
        : "We couldn't reach the marketplace. Please try again in a moment.",
    );
  }
  if (response.status === 204) return null;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404)
      throw new Error(
        "This car is no longer available. Refresh the listings to continue.",
      );
    if (response.status === 422)
      throw new Error(
        "Some details couldn't be saved. Check the name, year, price and mileage, then try again.",
      );
    throw new Error(
      "Something went wrong. Your changes couldn't be confirmed. Please refresh the listings.",
    );
  }
  return body;
}

export async function getCars(
  offset: number,
): Promise<{ cars: Car[]; hasMore: boolean }> {
  // One extra row tells us if another page exists without inventing a total count.
  const body = await carRequest(
    `/cars?limit=${PAGE_SIZE + 1}&offset=${offset}`,
  );
  if (
    !Array.isArray(body) ||
    body.length > PAGE_SIZE + 1 ||
    !body.every(isCar)
  ) {
    throw new Error("The listings couldn't be read. Please try again.");
  }
  return { cars: body.slice(0, PAGE_SIZE), hasMore: body.length > PAGE_SIZE };
}

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export function photoFor(make: string): string | null {
  const photos: Record<string, string> = {
    porsche: "/images/porsche.jpg",
    bmw: "/images/bmw.jpg",
    "mercedes-benz": "/images/mercedes.jpg",
    mercedes: "/images/mercedes.jpg",
    audi: "/images/audi-rs6.jpg",
  };
  return photos[make.toLowerCase()] ?? null;
}
