# AGENTS.md

## Project Overview

Valorant Premier team management app. AdonisJS 6 + Edge.js v6 + htmx + Tailwind CSS + SQLite.

## Architecture

```
app/
  controllers/    # Request handlers (REST-style, return Edge views or htmx partials)
  middleware/     # auth, admin, guest, silent_auth
  models/         # Lucid ORM models (User, Match, Map, StratBook, etc.)
  services/       # timezone_service.ts for availability conversions
  validators/     # VineJS validation schemas
  exceptions/     # Global error handler

resources/views/
  components/     # Reusable Edge components (Edge v6 component syntax)
  pages/          # Full page templates (auth, players, matches, strats, etc.)
  partials/       # htmx swap targets

config/           # AdonisJS config files
database/
  migrations/     # Schema changes
  seeders/        # admin_seeder, maps_seeder

start/
  routes.ts       # All route definitions
  kernel.ts       # Middleware stack
```

## Key Patterns

**Edge.js v6**: Uses the new component syntax with `@!` for self-closing and `@` for block components. Layouts use `@layout()` / `@end`. Slots use `@slot()` / `@end`. Do NOT use Edge v5 syntax (`@component()`, `@section()`).

**IMPORTANT**: All Edge `@` tags MUST be on their own line to be parsed correctly. Never put `@tag()` inline with HTML on the same line - Edge will output it as literal text.

### Edge.js scope: `@include` vs `@!component`

The single most error-prone area in Edge.js v6 is variable scope across templates. Internalize these rules:

- **`@let` is a real JS `let`** — block-scoped. A binding declared inside `@if(foo)` is NOT visible after the `@endif`. The CLAUDE memory note about "Cannot access before initialization" is one symptom of this; "X is not defined" at runtime is another.
- **`@include('path')` inlines the partial into the parent's scope.** The partial sees every `@let` the parent has declared *up to that point in execution*. This sounds convenient but is the trap: if the parent declared `@let(match = ...)` inside a conditional that didn't run, and *anywhere later in the parent template* — including inside a different included partial — references `match`, you get `ReferenceError: match is not defined` reported at the `@include` line, even when neither the partial nor the line in question references `match` directly. The error message points at the include site, not the actual reference.
- **`@!component('components/foo', { props })` has ISOLATED scope.** The component only sees the props you pass it (accessed as plain variables: `{{ balance }}`, not `{{ $props.balance }}`). It does NOT inherit the parent's `@let` bindings, which means it can't break when the parent's conditional `@let`s don't get declared.

**Rule of thumb**: prefer `@!component` over `@include` whenever the partial doesn't genuinely need the parent's scope. Use `@include` only when the partial truly needs to read the parent's local variables (e.g., the existing `partials/match_availability_buttons.edge` which reads `match` and `compact`).

**If an `@include` errors with "X is not defined" at the include line**: don't bother grepping the partial for X — the partial doesn't reference it. The cause is almost always a parent `@let(X = ...)` declared inside a conditional that didn't execute. Either hoist the `@let` to before any conditional, or convert the include to a component.

### Looking up Edge.js docs

- Primary docs: <https://edgejs.dev/docs/> — best source for current behavior. Sections: `templates_state` (variables, `@let`, `@each`), `partials` (`@include`), `components/introduction` (`@component` / `@!component`).
- Adonis-flavored docs: <https://docs.adonisjs.com/guides/views-and-templates/edgejs> — integration-specific patterns.
- The codebase ships with edge.js v6.4.0 (see `node_modules/.pnpm/edge.js@6.4.0/`); when behavior is ambiguous, the compiled JS in `build/index.js` and `build/js-stringify-*.js` is authoritative.

**Controllers**: Return `view.render('pages/...')` for full pages, or partials for htmx requests. Check `request.header('HX-Request')` to detect htmx.

**Auth**: Two roles: `admin` and `player`. Admins can mutate; players read-only. Use `middleware.admin()` on routes.

**htmx**: Used for delete buttons, availability toggles, result buttons. Patterns:

- `hx-delete`, `hx-put` with `hx-target` and `hx-swap`
- Return partial HTML for swaps
- `hx-confirm` for destructive actions

**hx-boost**: The app layout has `hx-boost="true"` on the body, which makes all links use AJAX navigation. This improves performance but requires attention:

1. **File upload forms**: Must have `hx-boost="false"` - boost sends data as urlencoded, breaking multipart/form-data uploads
2. **Logout/login forms**: Must have `hx-boost="false"` - session changes need full page reload
3. **Out-of-band swaps**: Partials with `hx-swap-oob="true"` are stripped during boosted navigation if no matching element exists. Make OOB conditional:
   ```edge
   <div id="my-element" if @if(isOobSwap) hx-swap-oob="true" @end>
   ```
   Pass `isOobSwap: true` only from HTMX response handlers, not full page renders.
4. **External links**: Use `target="_blank"` to bypass boost
5. **Inline scripts**: Scripts in page templates do execute on boosted navigation (HTMX 1.9+), but be aware of this behavior

**Timezones**: All DB times are UTC. User has `timezone` field. Use `TimezoneService` for conversions.

**File Uploads**: Store in `storage/uploads/`. Served via `/uploads/*` route. Delete old files when replacing.

## Models & Relationships

- `User` hasMany `WeeklyAvailability`, `MatchAvailability`
- `Match` hasMany `MatchAvailability`, belongsTo `Map`
- `Map` hasMany `StratBook`, `Match`
- `StratBook` hasMany `StratImage`, belongsTo `Map`

## Commands

**IMPORTANT: Always use `pnpm`, never `npm` or `yarn`.**

```bash
pnpm install      # Install dependencies
pnpm add <pkg>    # Add a package
pnpm dev          # Dev server with HMR
pnpm build        # Production build
node ace migration:run
node ace db:seed
pnpm lint
pnpm typecheck
```

## Adding Features

1. **New route**: Add to `start/routes.ts`, group under auth/admin as needed
2. **New model**: Create in `app/models/`, add migration in `database/migrations/`
3. **New controller**: Create in `app/controllers/`, import lazily in routes
4. **Validation**: Create validator in `app/validators/`, use `request.validateUsing()`
5. **Views**: Full pages in `resources/views/pages/`, partials for htmx

## Cross-Browser Compatibility

**Do NOT use vendor-specific CSS** like `-webkit-*` prefixes or `::webkit-*` pseudo-elements. The primary user uses Firefox (Gecko engine), so webkit-specific solutions will not work.

For styling native form inputs (date pickers, etc.):

- Use standard CSS properties that work across browsers
- Consider using a JavaScript-based picker library if native inputs need significant customization
- Test in Firefox, not just Chrome/Safari

## Do NOT Inline SVGs

Never inline SVG code directly into templates. Always use a reusable approach - either a component, partial, or utility function. Inlining SVGs creates duplication and maintenance problems.

## Testing

### Commands

```bash
pnpm test       # Functional HTTP tests (Japa + API client)
pnpm test:e2e   # Browser E2E tests (Playwright)
pnpm lint       # Static checks
pnpm typecheck  # Type checks
```

Always run `pnpm typecheck` and `pnpm lint` before committing.

### Strategy

- **Black-box only**: test user-visible behavior via HTTP and browser APIs. No controller/model unit tests.
- **Functional tests** (`tests/functional/`): hit real endpoints, assert status codes, redirects, HTML content, and data persistence. Both HTMX (`HX-Request: true`) and non-HTMX paths are tested for mutating endpoints.
- **E2E tests** (`tests/e2e/`): Playwright against a real running server. Cover key user flows (auth, match CRUD, availability, file upload, role gating).

### Coverage Areas

- **Auth & session**: login, logout, invalid login, guest redirect, onboarding/approval middleware
- **Role gating**: admin can CRUD matches; player is blocked from mutate endpoints
- **HTMX contracts**: delete/result/availability endpoints return correct partials (or empty body) with OOB fragments when HX-Request is set, and redirect when it's not
- **Validation**: invalid payloads are rejected, data is not mutated, error messages render
- **File uploads**: profile logo upload/replace/delete, strat image upload/delete. Old files are removed on replace.
- **Timezones**: same UTC match time renders differently for users in different timezones (fixed timestamp, deterministic)

### Test Infrastructure

- **`tests/helpers/api_client.ts`**: `SessionClient` wraps Japa's API client with a cookie jar to maintain session state across requests.
- **`tests/helpers/session.ts`**: `loginAs()`, `submitLogin()`, `getCsrfTokenFromAppPage()` helpers. CSRF tokens are fetched from real rendered pages.
- **`tests/helpers/factories.ts`**: `createUser()`, `createAdminUser()`, `createMatch()`, `createMap()` with sensible defaults. Match `scheduledAt` defaults to `2099-01-01` to avoid date boundary flakiness.
- **`tests/helpers/test_setup.ts`**: `runMigrationsOnce()` (single-process assumption), `beginTransaction()`/`rollbackTransaction()` for per-test isolation.
- **`tests/fixtures/`**: test images for upload tests.

### Writing New Tests

1. Add functional tests in `tests/functional/<feature>.spec.ts`
2. Use the same group setup pattern (migrations once, transaction per test)
3. Use `SessionClient` + `loginAs()` for authenticated requests
4. Fetch CSRF tokens from rendered pages — don't bypass CSRF
5. Assert status codes and redirects first, then check data persistence, then HTML content
6. For HTMX endpoints, test both with and without `HX-Request: true` header
7. For file upload tests, clean up uploaded files (ideally in teardown)

### Known Limitations

- E2E only runs Chromium (primary user browser is Firefox — consider adding Firefox project)
- E2E tests share state (no per-test cleanup) — test order matters
- Functional and E2E share the same SQLite DB file — don't run concurrently
- File cleanup in upload tests is done inline, not in teardown — orphaned files if test fails mid-run
