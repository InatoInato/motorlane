# Motorlane agent rules

Copy the three AGENTS.md files into the matching paths of your existing project.
Replace the earlier copies; keep one root file and one in each application.
Do not copy these rules into every source directory.

- motorlane/AGENTS.md: shared workflow, scope, contracts and integration boundaries.
- motorlane/api/AGENTS.md: API engineer; data correctness and simple backend code.
- motorlane/web/AGENTS.md: UI/UX engineer; usable screens and frontend quality.

The blue/neutral visual direction applies to future UI work. This bundle changes
instructions only; it does not recolor the existing starter page.

## UI ticket prompt

Read AGENTS.md and web/AGENTS.md. Work as the UI/UX engineer.
Task: [screen and user goal]. Scope: web/.
Use the existing API contract; report any missing endpoint.
Acceptance: [main interaction, mobile behavior, loading and error state].
Implement the smallest readable change, run checks, and show the diff. Do not commit.

## API ticket prompt

Read AGENTS.md and api/AGENTS.md. Work as the API engineer.
Task: [behavior and request/response contract]. Scope: api/.
Acceptance: [success, permission/data invariant, relevant failure case].
Use the existing architecture. Run relevant checks and report their results.
Explain the code and decisions briefly. Do not commit.

## Review and collaboration

For a ticket spanning both applications, define the HTTP contract and errors first.
If agents actually work in parallel, use separate branches/worktrees and review
integration explicitly. Role instructions do not prevent bugs or enforce access
restrictions. Human diff review and executed checks remain necessary.
