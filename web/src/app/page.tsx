import { getCars, PAGE_SIZE } from "./cars";
import { Marketplace } from "./marketplace";

type Params = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const pageNumber = Number(value("page"));
  const page =
    Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 100000
      ? pageNumber
      : 1;
  let result: Awaited<ReturnType<typeof getCars>> = {
    cars: [],
    hasMore: false,
  };
  let error = "";
  try {
    result = await getCars((page - 1) * PAGE_SIZE);
  } catch (cause) {
    error =
      cause instanceof Error
        ? cause.message
        : "The marketplace is unavailable. Please try again.";
  }
  return (
    <Marketplace
      {...result}
      error={error}
      page={page}
      filters={{
        q: value("q"),
        make: value("make"),
        budget: value("budget"),
        sort: value("sort") || "latest",
      }}
    />
  );
}
