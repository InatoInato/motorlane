import Link from "next/link";

export default function Loading() {
  return (
    <main className="shell loading-page" aria-busy="true">
      <Link className="wordmark" href="/">
        motorlane<span className="brand-dot">.</span>
      </Link>
      <h1>Finding your next chapter.</h1>
      <p role="status">Loading the marketplace…</p>
    </main>
  );
}
