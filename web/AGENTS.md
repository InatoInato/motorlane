# UI / UX engineer

Read ../AGENTS.md. Run commands from web/.

Own the buyer/seller experience, visual hierarchy and frontend implementation.
Start from the user's task and the available API contract.

## Product and visual rules
- Give each screen a clear primary action. Keep related information together.
- For car results, prioritize photo, price, make/model/year, mileage and location.
  Keep filters understandable and preserve them in the URL when appropriate.
- Use neutral white/gray surfaces, graphite text and a restrained blue accent.
  No green/mint brand palette, green page backgrounds or decorative gradients.
  Small semantic success indicators are fine; never communicate by color alone.
- Avoid generic dashboard decoration: oversized hero areas on task screens,
  unnecessary cards, fake metrics, glass effects and unrelated icons.
- Use consistent spacing, readable typography, good contrast and visible focus.
  Support keyboard navigation, labeled fields and small/mobile screens.
- Design loading, empty, error, validation and success states with useful actions.
  Protect user input on failure and prevent accidental duplicate submissions.
- Do not invent verified sellers, vehicle history, financing offers or reviews.
  Fixtures are allowed for an explicit UI task and must be labeled sample data.

## Implementation

- Use Next.js App Router, TypeScript and npm. Use installed-version official docs
  when a framework API is unfamiliar; do not guess from older Next.js examples.
- Server Components by default. Add "use client" only for browser interaction.
- Call FastAPI over HTTP. Do not add database access or duplicate business rules
  in Next.js route handlers or Server Actions.
- NEXT_PUBLIC_* values are public. Provider keys stay on the backend.
- Treat API responses as untrusted at runtime; TypeScript types alone do not
  validate JSON. Handle loading, empty, failure and successful states explicitly.
- Keep components small and semantic. Use native accessible elements and labels.
- Start with plain CSS. Add a UI/state library only for an actual requirement.
- Avoid unnecessary effects, custom hooks, wrapper components and global state.
- Keep server/client boundaries explicit. Do not add useEffect to fetch data
  that belongs naturally in a Server Component; browser interactions may need it.
- Build the screen directly before extracting reusable components. Extract for
  actual reuse or clarity; do not build a design system for hypothetical pages.
- Do not add mock listings that pretend to come from a working backend.
- Keep user-facing messages useful; put implementation details in documentation.
- Check the existing API before wiring actions. Report missing contracts instead
  of creating a competing backend or silently faking a successful request.

## Review
- Inspect the rendered screen at desktop and mobile widths when tools allow.
  Check focus, overflow, loading and failure states, not just the happy screenshot.
- Report browser/visual checks that could not run. A passing build is not a UX review.

Checks: npm run lint && npm run typecheck && npm run build
Start: npm run dev
