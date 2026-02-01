# Operators - Valorant Premier Team Management

AdonisJS 6 + Edge + HTMx team management site for Valorant Premier.

## Tech Stack

AdonisJS 6 | SQLite | Edge.js | HTMx | Tailwind CSS

## Database Schema

**Users**: id, full_name, email, password, role ('admin'|'player'), timezone (default 'Australia/Sydney')

**Weekly Availabilities**: user_id, day_of_week (0-6), hour (0-23 UTC), is_available

- Unique: (user_id, day_of_week, hour)

**Matches**: id, scheduled_at (UTC), opponent_name, map, match_type ('scrim'|'official'), result ('win'|'loss'|'draw'|null), notes

**Match Availabilities**: match_id, user_id, status ('yes'|'no'|'maybe'|'pending')

- Unique: (match_id, user_id)

**Maps**: id, name, is_active

**Strat Books**: id, map_id, title, description, valoplant_url, sort_order

**Strat Images**: id, strat_book_id, filename, original_name, sort_order

## Routes Reference

```
Auth:     GET|POST /login, POST /logout, GET|PUT /settings/password
Dashboard: GET /dashboard
Players:  CRUD /players (admin-only for mutations)
Availability: GET|PUT /availability
Matches:  CRUD /matches, PUT /matches/:id/result (admin-only for mutations)
Match Avail: PUT /matches/:id/availability
Strats:   /strats/:mapSlug/* (admin-only for mutations)
Public:   GET /, /roster, /results
```

## Completed Phases

- ✅ Phase 1: Foundation & Auth (layouts, login, middleware, seeder)
- ✅ Phase 2: Player Management (CRUD, HTMx delete)
- ✅ Phase 3: Availability System (weekly grid, timezone handling)
- ✅ Phase 4: Match Calendar (CRUD, result buttons)
- ✅ Phase 5: Match Availability (per-match responses, summaries)
- ✅ Phase 6: Strat Books (map strats, image uploads, Valoplant links)
- ✅ Phase 7: Public Views (home, roster, results)

## Remaining Work

**Phase 8: Polish**

- [ ] Loading states for HTMx requests (spinners/indicators during requests)
- [x] Consistent styling, flash messages, responsive design, error handling

**Phase 9: Player Profiles Enhancement** ✅

_Database & Model_

- [x] Create migration to add `logo_filename` (nullable string) and `trackergg_username` (nullable string) columns to users table
- [x] Update User model with `logoFilename` and `trackerggUsername` columns
- [x] Add computed getter for full tracker.gg URL: `https://tracker.gg/valorant/profile/riot/{username}`

_Validators & Controller_

- [x] Update player validators to accept optional logo file (jpg, jpeg, png, gif, webp; max 2mb) and trackergg_username (string, max 100 chars)
- [x] Update players controller `store()` to handle logo upload (save to `/storage/uploads/players/`)
- [x] Update players controller `update()` to handle logo upload/replacement (delete old file if replacing)
- [x] Add DELETE `/players/:id/logo` route for HTMx logo removal (returns updated player card partial)

_Views - Forms (HTMx enhanced)_

- [x] Add logo file input in `create.edge` with client-side preview (JS FileReader for instant preview)
- [x] Add logo file input in `edit.edge` showing current logo with HTMx delete button (`hx-delete`, `hx-target`, `hx-swap`)
- [x] Add tracker.gg username input field in `create.edge` and `edit.edge` forms
- [x] Create `player_logo.edge` partial for reusable logo display with delete functionality

_Views - Display_

- [x] Display player logo in `show.edge` (fallback to initials/placeholder if no logo), tracker.gg link (external link icon, opens in new tab)
- [x] Display player logo thumbnail in `index.edge` table
- [x] Display player logos and tracker.gg links in public `/roster` page
