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

## Testing Changes

No test suite currently. Verify manually:

- Run `pnpm typecheck` and `pnpm lint` before committing
- Test both admin and player roles
- Test htmx interactions (check Network tab for partial responses)
- Test timezone handling if touching availability
- Test navigation via clicking links (hx-boost) not just direct URL access - elements may render differently
