# Add Agent Selection to Player Profiles, Match View, and Public Roster

## Summary
Introduce a structured agent-selection feature tied to users. Players can choose 1–28 agents via a role-grouped icon grid (with “Select all in role” buttons). Admins can edit a player’s agents via Player Edit. Agents will display next to players in Match view and on the public roster.

## Data Model and Storage
- Add `users.agent_prefs` (JSON array of agent keys) via a new migration.
- Default empty array `[]` for existing users.
- User model exposes `agentPrefs` as an array.
- Single source of truth for agents/roles in `app/constants/agents.ts`.

## Validation and Constraints
- Players must select at least one agent.
- Validate `agents[]` in:
  - `updateProfileValidator` (profile settings update).
  - `updatePlayerValidator` (admin edit).
- Ensure each value is one of `AGENTS` keys; min 1, max 28.

## UI/UX: Agent Selection Grid
- Reusable Edge partial `resources/views/partials/agent_select_grid.edge`.
- Role sections: Duelist, Initiator, Controller, Sentinel.
- “Select all” per role group.
- Icons from `/images/agent-icons/{agentKey}.png`.
- Minimal JS for role “Select all”.

## Places to Edit
1. Profile Settings: `resources/views/pages/settings/profile.edge`
2. Admin Edit Player: `resources/views/pages/players/edit.edge`

## Places to Display
1. Match View: add agents next to player names in `resources/views/partials/team_match_availability.edge`.
2. Public Roster: show agent icons under each player in `resources/views/pages/public/roster.edge`.

## Controllers and Data Loading
- SettingsController.updateProfile: persist `agentPrefs`.
- PlayersController.update: persist `agentPrefs`.
- MatchesController.show + PublicController.roster: ensure agentPrefs available (already on User).

## Edge Cases
- Users with empty selection fail validation on submit.
- Display “No agents selected” only in admin-only contexts; hide on public/match view.

## Tests / Verification
1. Profile settings: select 1 agent; save; persist; reload.
2. Validation: save with none; error.
3. Admin edit: change player agents; verify displays.
4. Match view: agent icons show for players.
5. Public roster: agent icons show for players.
6. Assets: icon filenames match keys.

## Progress
- [x] Add agent constants and role mappings.
- [x] Add migration for `users.agent_prefs`.
- [x] Wire `agentPrefs` on `User` model.
- [x] Update validators and controllers to persist agent selection.
- [x] Add agent selection grid partial and hook into profile/admin edit.
- [x] Display agent icons in match availability and public roster.
- [x] Run `pnpm typecheck`.
- [ ] Run migrations and manually verify UI/flows.

## Follow-up Enhancements
- [x] Show agents on player detail page.
- [x] Add overflow popover for preferred agents in match detail.
- [x] Store and display actual agents for completed matches via Valorant match data.
- [x] Add played agents section to match details for completed matches.
- [x] Include agent names + K/D/A in played agents table.
- [x] Close match selector and refresh after sync.
- [ ] Run migrations for new match player agents table.
