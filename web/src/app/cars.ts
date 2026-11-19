let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export type CarInput = {
  make: string;
  model: string;
  year: number;
  price: number;
  milage: number;
};

export type Car = CarInput & {
  id: number;
  owner_id?: number | null;
  photo_url?: string | null;
};
export const PAGE_SIZE = 12;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function isPhotoUrl(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

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
    Number(car.milage) >= 0 &&
    isPhotoUrl(car.photo_url)
  );
}

export async function carRequest(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const auth = path.startsWith("/auth/");
  const photo = path.endsWith("/photo");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(photo ? 25000 : 8000),
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      auth
        ? "We couldn't reach your account. Please try again."
        : photo
          ? "The photo upload couldn't be confirmed. Try again."
          : options.method && options.method !== "GET"
            ? "We couldn't confirm your changes. Check the listings before trying again."
            : "We couldn't reach the marketplace. Please try again in a moment.",
    );
  }
  if (response.status === 204) return null;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if ([401, 403, 409].includes(response.status))
      throw new Error(
        response.status === 401
          ? "Please sign in with a valid username and password."
          : response.status === 403
            ? "Only the seller can change this listing."
            : "That username is already taken.",
      );
    if (response.status === 404)
      throw new Error(
        "This car is no longer available. Refresh the listings to continue.",
      );
    if (photo) {
      if (response.status === 413)
        throw new Error("Choose a cover photo no larger than 5 MB.");
      if (response.status === 415)
        throw new Error(
          "Choose a valid JPEG, PNG or WebP image (up to 25 million pixels).",
        );
      throw new Error("The cover couldn't be saved. Try again.");
    }
    if (auth && response.status === 422)
      throw new Error("Check your username and password and try again.");
    if (auth)
      throw new Error(
        "We couldn't complete this account request. Please try again.",
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
