# Fetch Match Score from Valorant API

## Summary

Add admin feature to fetch match scores from Henrik's Valorant API by searching a roster player's recent match history.

## User Flow

1. Admin clicks "Fetch from Valorant" button on match show page
2. Modal shows roster players with Riot ID configured
3. Admin picks a player to search
4. System fetches player's recent matches from Henrik API
5. Admin picks the correct match from list (shows map, score, date, mode)
6. Score saved to match, result auto-set based on score

## Files to Modify/Create

### Database

- [x] **NEW** `database/migrations/1770104506976_create_add_score_columns_to_matches_table.ts`
  - Add `score_us` (integer, nullable)
  - Add `score_them` (integer, nullable)

### Model

- [x] `app/models/match.ts` - Add `scoreUs` and `scoreThem` columns

### Environment

- [x] `start/env.ts` - Add `HENRIK_API_KEY` to schema (already in .env)

### Service

- [x] **NEW** `app/services/valorant_api_service.ts`
  - `parseRiotId(riotId)` - Split "Name#TAG" into components
  - `getRecentMatches(name, tag)` - Fetch from Henrik API, return parsed matches
  - Identify "us" team by finding searched player in match data

### Controller

- [x] `app/controllers/matches_controller.ts` - Add 3 methods:
  - `fetchFromValorantStep1` - Show player selection
  - `fetchFromValorantStep2` - Fetch & show recent matches
  - `fetchFromValorantSave` - Save selected score, auto-set result

### Routes

- [x] `start/routes.ts` - Add 3 admin-only routes:
  - `GET /matches/:id/fetch-valorant/step1`
  - `POST /matches/:id/fetch-valorant/step2`
  - `POST /matches/:id/fetch-valorant/save`

### Views

- [x] `resources/views/pages/matches/show.edge`
  - Add "Fetch from Valorant" button (admin only)
  - Add modal container
  - Display score if present (e.g., "13-7")
- [x] **NEW** `resources/views/partials/valorant_fetch/step1_select_player.edge`
- [x] **NEW** `resources/views/partials/valorant_fetch/step2_select_match.edge`
- [x] **NEW** `resources/views/partials/valorant_fetch/error.edge`

## Henrik API Details

- Endpoint: `GET https://api.henrikdev.xyz/valorant/v3/matches/{region}/{name}/{tag}`
- Auth header: `Authorization: {API_KEY}`
- Default region: `na`
- Response includes: match metadata, team scores (rounds_won), players with team assignment

## Implementation Order

1. Migration + Model update
2. Add env var to schema
3. Create ValorantApiService
4. Add routes
5. Add controller methods
6. Create view partials
7. Update match show page

## Verification

1. Run migration: `node ace migration:run`
2. Start server: `npm run dev`
3. Go to an existing match as admin
4. Click "Fetch from Valorant"
5. Select a player with Riot ID set
6. Verify API returns recent matches
7. Select a match, confirm score is saved
8. Verify result is auto-set (win/loss/draw)
