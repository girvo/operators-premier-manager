# Test Plan (Public Interface Focus)

## Guiding Principles
1. Test user-visible behavior only: response status, redirects, rendered HTML, visible text, data persistence effects, and access control.
2. Prefer black-box tests: interact via HTTP and the browser; avoid calling controllers or models directly.
3. Protect critical flows first: auth, role gating, CRUD, htmx swaps, file uploads, timezone conversions.

## Recommended Testing Layers (Behavior-Driven Pyramid)

### 1) E2E/Browser Tests (small number, high value)
Tool: Playwright or Cypress (Playwright tends to be better with modern browser automation).

What to test:
- Auth flows: login, logout, session persistence.
- Admin vs player access: admin can mutate, player is read-only.
- htmx interactions: delete buttons, availability toggles, partial swaps.
- File uploads (with hx-boost="false"): upload success + replacement deletes old file.
- Navigation with hx-boost="true": clicking links should update content (not full reload) and scripts still run.

Assertions:
- Visible text, presence/absence of buttons, URL changes, network responses.
- DOM content changes after htmx actions (swap targets updated).
- No-permission UX (redirect to login / 403 page).

Stability rules:
- Prefer semantic selectors (role + accessible name) over CSS.
- Add data-testid only for volatile UI elements that change styling/structure.
- Wait on app signals (network response or swap target change), not timeouts.
- Keep E2E small and coarse; move detailed coverage to HTTP tests.
- Disable animations and randomness in test mode.

### 2) HTTP Integration Tests (medium number)
Use Adonis HTTP client to make requests, but treat it like a public API.

What to test:
- Status codes, redirects, response body includes key text.
- Access control: 401/403 for role mismatch.
- Correct response for htmx requests (HX-Request: true header).
- Form validation errors render expected messages.
- Timezone conversions: ensure displayed times differ by user timezone for same stored UTC time.

Assertions:
- HTML structure and content, not internal methods.
- For htmx: correct partial and swap target content.

### 3) Selective API Tests for Helpers/Services (only if externally observable)
If a service drives visible output (e.g., timezone conversion), test it through the route that displays it instead of unit testing it directly.

If the logic is too complex to reach via UI without huge setup, a small number of targeted unit tests are acceptable—but treat them as last resort.

## htmx-Specific Behavior to Cover
- HX-Request responses return partials only.
- hx-delete / hx-put work and replace the correct target (hx-target).
- hx-confirm prevents accidental deletes.
- OOB swaps only for htmx responses (and suppressed for full page renders).
- hx-boost exceptions:
  - File upload forms and auth forms must have hx-boost="false".

## Test Data Strategy
- Use factories/seeders to set up realistic data through DB or fixtures.
- Reset database between tests (transactional tests or truncate).
- Use one admin and one player user fixture to validate role boundaries.
- Provide deterministic test data (fixed timestamps, stable ordering) for E2E.

## What Public Interface Tests Look Like
- Given a logged-in admin, when I click "Delete Match," the row disappears and a success toast appears.
- Given a player, when I visit /matches/create, I get a 403 (or redirect) and do not see the form.
- Given a user in America/Los_Angeles, when I view a match at 18:00 UTC, I see 10:00 AM.
- Given an htmx request to /matches/1, I get a partial containing only the swap target.

## Avoid This
- Testing controller methods directly.
- Mocking ORM calls inside controller tests.
- Assertions about exact DOM structure unless it is a public UI contract.
- Snapshot tests of entire HTML pages (too brittle with Edge + htmx).

## E2E Resilience Guidelines
- Prefer stable selectors:
  - Use `getByRole()` with accessible names.
  - Use `data-testid` for swap targets and critical actions.
- Make swap targets stable:
  - Ensure row/section IDs are deterministic (e.g. `match-row-123`).
- Wait for concrete changes:
  - Wait for the specific swap target to be replaced/removed.
  - Wait for a specific network response (delete endpoint returns 200/204).
- Avoid visual assertions:
  - Don’t assert on layout, positions, or exact HTML.
- Reduce nondeterminism:
  - Use fixed timestamps in test data.
  - Disable animations during tests (CSS or JS flag).

## Minimal Starting Suite
1. Login/logout E2E.
2. Admin can create/edit/delete a Match via htmx.
3. Player can view Match list but cannot mutate (403).
4. File upload works and old file removed on replace.
5. Timezone display for a known UTC time in two timezones.

## Minimal Resilient E2E Examples (Behavior-Level)
- Login: submit form, assert user name appears in nav and URL changes.
- Admin delete match: click Delete (by role/name), wait for `#match-row-<id>` to disappear.
- htmx toggle availability: click toggle, wait for target text to change.
- File upload: attach file, submit, assert thumbnail/link appears.

## Implemented (Initial)
- Auth functional tests: login page renders, valid login redirects, unauthenticated redirects, player blocked from admin route.
- Match functional tests: htmx delete returns empty response and removes record, htmx result update returns badge and persists.
