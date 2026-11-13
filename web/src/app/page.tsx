import { HealthStatus } from "./health-status";

export default function Home() {
  return (
    <main>
      <p className="eyebrow">MOTORLANE / PROJECT FOUNDATION</p>
      <h1>Your next car starts here.</h1>
      <p className="intro">
        A used-car marketplace in development. Listings and seller tools are next.
      </p>
      <section aria-labelledby="connection-heading">
        <h2 id="connection-heading">Service connection</h2>
        <HealthStatus />
      </section>
    </main>
  );
}
