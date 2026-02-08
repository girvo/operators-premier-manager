# Discord Player Nudge Plan

## Goal
Allow admins to send a targeted Discord DM nudge to a roster player when required team data is missing:
- Weekly availability
- Agent preferences (used as current role-input proxy)
- Plus expose admin-only player `last login` metadata to support better nudge decisions.

This is a planning artifact only. It defines implementation approach, sequencing, and acceptance criteria.

## Why This Feature
- Admins currently have no in-app workflow to prompt non-responsive players.
- Missing availability/agent prefs directly impacts weekly lineup and prep quality.
- We already store `discordId` and already send Discord notifications, so this is additive.

## Scope (MVP)
- Add an admin-only "Nudge" action for a player.
- Determine which required inputs are missing for that player.
- Send a Discord DM directly from this backend using the Discord bot token.
- Show result feedback in UI (sent / blocked / cooldown / failed).
- Record each nudge attempt for auditability and cooldown enforcement.
- Add admin-only display of each player's last login timestamp.

Out of scope for MVP:
- Bulk nudge all players
- Automated scheduled nudges
- Multi-step reminder cadence
- Rich analytics dashboards

## Current State Notes (from codebase)
- `User` already has `discordId` and `agentPrefs`.
- Weekly availability is stored in `weekly_availabilities`.
- Existing Discord service uses webhook channel notifications (not user DMs).
- Admin/player separation and HTMX patterns are already established.
- No existing `last login` column or login timestamp write path is present.

## Key Product Decisions

### Missing-data rules (initial)
- `missingAvailability`: user has zero availability rows in `weekly_availabilities`.
- `missingAgents`: `agentPrefs.length === 0`.

Rationale: predictable and cheap to compute. We can expand later (ex: "stale" availability).

### Cooldown policy
- 24-hour cooldown per `(user_id, reason)` to prevent spam.
- Reason value for MVP:
  - `profile_data_missing` (covers missing availability and/or agents)

### Nudge eligibility
- Admin only.
- Target must be approved roster player (`isOnRoster = true`, `approvalStatus = approved`).
- Must have `discordId`.
- Must currently have at least one missing requirement.

## Discord Delivery Architecture
Decision: use native bot integration in this app (Option B).

- This backend calls Discord REST API directly:
  - Create DM channel: `POST /users/@me/channels`
  - Send message: `POST /channels/{channel_id}/messages`
- Auth is `Authorization: Bot <DISCORD_BOT_TOKEN>`.
- No separate Discord bridge service is required.

## Data Model Plan
Add a new table: `player_nudges`

Columns:
- `id` (pk)
- `user_id` (target player)
- `admin_user_id` (who triggered)
- `reason` (string enum-like)
- `status` (`sent` | `blocked` | `failed`)
- `missing_availability` (boolean)
- `missing_agents` (boolean)
- `error_code` (nullable string)
- `error_message` (nullable string)
- `sent_at` (nullable datetime)
- `created_at`, `updated_at`

Indexes:
- `(user_id, reason, created_at)` for cooldown checks
- `admin_user_id` for audit lookup

Also add a nullable column on `users`:
- `last_login_at` (timestamp/datetime, nullable)

Rationale:
- `NULL` cleanly represents "never logged in" (new/pending users).
- Single-column addition keeps the secondary feature lightweight.

## Backend Plan

### Service additions
- New service `PlayerNudgeService` responsibilities:
  - Compute missing-data state for a user.
  - Validate nudge eligibility.
  - Enforce cooldown.
  - Dispatch DM through integration client.
  - Persist audit row.

- New integration client `DiscordDmService`:
  - Encapsulate outbound calls to Discord REST API.
  - Standardized return shape: `{ ok, externalMessageId?, errorCode?, errorMessage? }`

### Auth write-path changes (last login)
On successful auth, set `user.lastLoginAt = now` and save:
- Email/password login in `AuthController.login`.
- Discord OAuth callback when existing user signs in.
- Discord OAuth callback when newly created user auto-signs in.

### Controller/route additions
- Route (admin-only): `POST /players/:id/nudge`
- Controller action on `PlayersController` (or separate `PlayerNudgesController` if preferred):
  - Load target user.
  - Run nudge service.
  - Return HTMX partial for row/player action state.
  - Non-HTMX fallback: flash message + redirect back.

### Response semantics
- `200`: nudge sent.
- `409`: cooldown active.
- `422`: not eligible / nothing missing / no discord.
- `502` or `500`: downstream DM failure.

## Frontend/UX Plan

### Admin surfaces
- Players list page: add `Nudge` button in each row (admin only).
- Player detail page: add `Nudge for missing data` button near `Edit Player`.
- Players list page: add `Last login` column (admin only).
- Player detail page: add `Last login` field in profile metadata (admin only).

### HTMX behavior
- Button uses `hx-post` to `/players/:id/nudge`.
- Target a compact status region in row/detail card.
- Show "Sending..." via existing `htmx-indicator` pattern.
- Update status text:
  - `Nudge sent just now`
  - `On cooldown (Xh Ym left)`
  - `Cannot nudge: player has no Discord linked`
  - `Failed to send nudge`

### Last-login display behavior
- Show localized timestamp using viewer/admin timezone for consistency with rest of app.
- If `last_login_at` is null, show `Never`.
- Keep display read-only and admin-only (no player exposure requirement).

### Copy template (MVP DM body)
Subject/intro:
- "Quick team admin reminder to complete your team data."

Body (dynamic):
- If missing availability: include `/availability` link.
- If missing agents: include `/settings/profile` link.
- Include app URL and friendly call-to-action.

## Environment / Config Plan
New env vars:
- `DISCORD_BOT_TOKEN`
- `APP_URL` already exists and will be used for links.

Validation:
- Add env schema entries in `start/env.ts`.
- Fail early if config missing in production.

## Security / Abuse Controls
- Admin middleware protection on route.
- Cooldown enforcement server-side only.
- Keep `DISCORD_BOT_TOKEN` server-side only (never exposed client-side).
- Audit all blocked and failed attempts (not just successful sends).

## Testing Plan

### Functional tests (Japa)
- Admin can nudge eligible player; audit row persisted with `status=sent`.
- Player role cannot hit endpoint (`403`/redirect behavior based on existing policy).
- Nudge blocked when:
  - no missing data
  - no `discordId`
  - cooldown active
- Downstream failure records `failed` and returns failure response.
- HTMX vs non-HTMX response paths both covered.
- Successful login updates `users.last_login_at`.
- Failed login does not update `users.last_login_at`.
- Admin pages render `Last login` value (or `Never`) only for admins.

### Suggested E2E test
- Admin clicks `Nudge` on players page and sees in-row status update.

## Rollout Plan
1. Ship behind simple feature flag (optional): `ENABLE_PLAYER_NUDGE`.
2. Test in staging with test Discord account.
3. Enable in production for admins.
4. Gather feedback on message wording/cooldown.

## Open Decisions (need confirmation before implementation)
1. Cooldown length:
   - Keep 24h or choose different window.
2. Missing availability rule:
   - MVP uses "no rows". Later may add "not updated this week".
3. UI location priority:
   - Players list only first, or list + player detail in same PR.
4. Last-login formatting:
   - Exact format string and whether to include relative text (ex: "2d ago") alongside absolute timestamp.

## Implementation Checklist
- [ ] Create migration and model for `player_nudges`.
- [ ] Add `PlayerNudgeService` and DM integration client.
- [ ] Add env schema + config wiring for DM transport.
- [ ] Add admin route `POST /players/:id/nudge`.
- [ ] Add controller action with HTMX/non-HTMX responses.
- [ ] Add nudge UI to players list.
- [ ] Add nudge UI to player detail page.
- [ ] Add functional tests for send/blocked/failure/permissions.
- [ ] Add E2E smoke test for admin nudge interaction.
- [ ] Add migration for `users.last_login_at` and model field.
- [ ] Update successful auth flows to write `last_login_at`.
- [ ] Add admin-only `Last login` UI on players list (+ detail page if included in scope).
- [ ] Add tests for last-login update and admin-only rendering.
- [ ] Run `pnpm typecheck` and `pnpm lint`.

## Acceptance Criteria (MVP)
- Admin can send one-click nudge for a player missing required data.
- Player receives Discord DM containing direct links to complete missing items.
- Repeated nudges within cooldown are blocked with clear UI feedback.
- Every attempt is auditable with outcome and error context.
- Non-admins cannot access nudge endpoint.
- Admins can see accurate per-player last login data (`Never` when absent) to guide nudge decisions.
