# Operators - Valorant Premier Team Management Website

## Overview

A team management website for the "Operators" Valorant Premier team, built with AdonisJS 6, server-rendered Edge templates, and HTMx for interactivity.

---

## Tech Stack

- **Backend**: AdonisJS 6 (already set up)
- **Database**: SQLite (already configured)
- **Auth**: Session-based email/password (already scaffolded)
- **Templates**: Edge.js
- **Interactivity**: HTMx
- **Styling**: Tailwind CSS (via CDN or Vite)

---

## Database Schema

### Users (modify existing)

| Column     | Type         | Notes                                 |
| ---------- | ------------ | ------------------------------------- |
| id         | INTEGER      | PK, auto-increment                    |
| full_name  | VARCHAR      | NOT NULL                              |
| email      | VARCHAR(254) | UNIQUE, NOT NULL                      |
| password   | VARCHAR      | hashed                                |
| role       | VARCHAR      | 'admin' or 'player', default 'player' |
| timezone   | VARCHAR      | default 'Australia/Sydney'            |
| created_at | TIMESTAMP    |                                       |
| updated_at | TIMESTAMP    |                                       |

### Weekly Availabilities

| Column       | Type    | Notes                    |
| ------------ | ------- | ------------------------ |
| id           | INTEGER | PK                       |
| user_id      | INTEGER | FK -> users              |
| day_of_week  | INTEGER | 0=Sun, 1=Mon, ..., 6=Sat |
| hour         | INTEGER | 0-23 in UTC              |
| is_available | BOOLEAN | default false            |

Unique constraint: (user_id, day_of_week, hour)

### Matches

| Column        | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| id            | INTEGER  | PK                             |
| scheduled_at  | DATETIME | stored in UTC                  |
| opponent_name | VARCHAR  |                                |
| map           | VARCHAR  | nullable                       |
| match_type    | VARCHAR  | 'scrim' or 'official'          |
| result        | VARCHAR  | 'win', 'loss', 'draw', or NULL |
| notes         | TEXT     | nullable                       |

### Match Availabilities

| Column   | Type    | Notes                           |
| -------- | ------- | ------------------------------- |
| id       | INTEGER | PK                              |
| match_id | INTEGER | FK -> matches                   |
| user_id  | INTEGER | FK -> users                     |
| status   | VARCHAR | 'yes', 'no', 'maybe', 'pending' |

Unique constraint: (match_id, user_id)

### Maps

| Column    | Type    | Notes                       |
| --------- | ------- | --------------------------- |
| id        | INTEGER | PK                          |
| name      | VARCHAR | UNIQUE (Ascent, Bind, etc.) |
| is_active | BOOLEAN | for map pool rotation       |

### Strat Books

| Column        | Type    | Notes        |
| ------------- | ------- | ------------ |
| id            | INTEGER | PK           |
| map_id        | INTEGER | FK -> maps   |
| title         | VARCHAR |              |
| description   | TEXT    | nullable     |
| valoplant_url | VARCHAR | nullable     |
| sort_order    | INTEGER | for ordering |

### Strat Images

| Column        | Type    | Notes                |
| ------------- | ------- | -------------------- |
| id            | INTEGER | PK                   |
| strat_book_id | INTEGER | FK -> strat_books    |
| filename      | VARCHAR | stored filename      |
| original_name | VARCHAR | original upload name |
| sort_order    | INTEGER |                      |

---

## Routes

### Authentication

```
GET  /login                -> AuthController.showLogin
POST /login                -> AuthController.login
POST /logout               -> AuthController.logout
```

### Dashboard

```
GET /dashboard             -> DashboardController.index
```

### Players (admin-only for create/update/delete)

```
GET    /players            -> PlayersController.index
GET    /players/new        -> PlayersController.create
POST   /players            -> PlayersController.store
GET    /players/:id        -> PlayersController.show
GET    /players/:id/edit   -> PlayersController.edit
PUT    /players/:id        -> PlayersController.update
DELETE /players/:id        -> PlayersController.destroy
```

### Availability

```
GET /availability          -> AvailabilityController.index
PUT /availability          -> AvailabilityController.update (HTMx)
```

### Matches (admin-only for create/update/delete)

```
GET    /matches            -> MatchesController.index
GET    /matches/new        -> MatchesController.create
POST   /matches            -> MatchesController.store
GET    /matches/:id        -> MatchesController.show
GET    /matches/:id/edit   -> MatchesController.edit
PUT    /matches/:id        -> MatchesController.update
DELETE /matches/:id        -> MatchesController.destroy
PUT    /matches/:id/result -> MatchesController.updateResult
```

### Match Availability

```
PUT /matches/:id/availability -> MatchAvailabilityController.update (HTMx)
```

### Strat Books (admin-only for create/update/delete)

```
GET    /strats                     -> StratsController.index
GET    /strats/:mapSlug            -> StratsController.showMap
GET    /strats/:mapSlug/new        -> StratsController.create
POST   /strats/:mapSlug            -> StratsController.store
GET    /strats/:mapSlug/:id/edit   -> StratsController.edit
PUT    /strats/:mapSlug/:id        -> StratsController.update
DELETE /strats/:mapSlug/:id        -> StratsController.destroy
POST   /strats/:mapSlug/:id/images -> StratsController.uploadImage
DELETE /strat-images/:id           -> StratsController.deleteImage
```

### Public (no auth required)

```
GET /                      -> PublicController.home
GET /roster                -> PublicController.roster
GET /results               -> PublicController.results
```

---

## Implementation Phases

### Phase 1: Foundation & Auth

**Files to modify/create:**

- `database/migrations/..._add_role_timezone_to_users.ts`
- `app/models/user.ts` - add role, timezone fields
- `app/middleware/admin_middleware.ts` - new
- `app/controllers/auth_controller.ts` - new
- `app/validators/auth_validator.ts` - new
- `resources/views/layouts/app.edge` - authenticated layout
- `resources/views/layouts/public.edge` - public layout
- `resources/views/pages/auth/login.edge`
- `start/routes.ts` - add auth routes
- `start/kernel.ts` - register admin middleware
- `database/seeders/admin_seeder.ts` - create initial admin user

**Tasks:**

1. Create migration to add `role` and `timezone` to users table
2. Update User model with new fields
3. Create admin middleware
4. Create auth controller and login view
5. Create base layouts with HTMx + Tailwind
6. Create admin seeder
7. Run migrations and seed

### Phase 2: Player Management

**Files to create:**

- `app/controllers/players_controller.ts`
- `app/validators/player_validator.ts`
- `resources/views/pages/players/index.edge`
- `resources/views/pages/players/show.edge`
- `resources/views/pages/players/create.edge`
- `resources/views/pages/players/edit.edge`

**Tasks:**

1. Create PlayersController with CRUD operations
2. Create validators for player data
3. Create all player views
4. Add routes with appropriate middleware
5. HTMx for inline deletion

### Phase 3: Availability System

**Files to create:**

- `database/migrations/..._create_weekly_availabilities_table.ts`
- `app/models/weekly_availability.ts`
- `app/services/timezone_service.ts`
- `app/controllers/availability_controller.ts`
- `app/validators/availability_validator.ts`
- `resources/views/pages/availability/index.edge`
- `resources/views/partials/availability/grid.edge`
- `resources/views/partials/availability/slot.edge`

**Tasks:**

1. Create weekly_availabilities migration and model
2. Create timezone service for UTC <-> user timezone conversion
3. Build availability grid UI (days x hours)
4. HTMx toggle for each slot
5. Display hours in user's timezone, store in UTC

**Timezone handling:**

- Store all times in UTC
- Display in user's configured timezone (Sydney/Brisbane)
- Handle DST differences between Sydney and Brisbane

### Phase 4: Match Calendar

**Files to create:**

- `database/migrations/..._create_maps_table.ts`
- `database/migrations/..._create_matches_table.ts`
- `app/models/map.ts`
- `app/models/match.ts`
- `app/controllers/matches_controller.ts`
- `app/validators/match_validator.ts`
- `database/seeders/maps_seeder.ts`
- `resources/views/pages/matches/index.edge`
- `resources/views/pages/matches/show.edge`
- `resources/views/pages/matches/create.edge`
- `resources/views/pages/matches/edit.edge`

**Tasks:**

1. Create maps and matches migrations/models
2. Seed all Valorant maps
3. Create MatchesController with CRUD
4. Create match views (list/calendar view)
5. Quick result update buttons (Win/Loss) via HTMx

### Phase 5: Match Availability

**Files to create:**

- `database/migrations/..._create_match_availabilities_table.ts`
- `app/models/match_availability.ts`
- `app/services/availability_service.ts`
- `app/controllers/match_availability_controller.ts`
- `resources/views/partials/matches/player-availability.edge`
- `resources/views/partials/matches/availability-summary.edge`

**Tasks:**

1. Create match_availabilities migration/model
2. Create service to calculate default availability from weekly schedule
3. Show Yes/No/Maybe buttons on match page
4. Display availability summary (who's in/out)
5. HTMx updates without page reload

### Phase 6: Strat Books

**Files to create:**

- `database/migrations/..._create_strat_books_table.ts`
- `database/migrations/..._create_strat_images_table.ts`
- `app/models/strat_book.ts`
- `app/models/strat_image.ts`
- `app/controllers/strats_controller.ts`
- `app/validators/strat_validator.ts`
- `resources/views/pages/strats/index.edge`
- `resources/views/pages/strats/map.edge`
- `resources/views/pages/strats/create.edge`
- `resources/views/pages/strats/edit.edge`

**Tasks:**

1. Create strat_books and strat_images migrations/models
2. Create StratsController
3. Map selection grid (click map -> see strats)
4. Image upload with AdonisJS Drive (local storage)
5. Link to Valoplant.gg for each strat

### Phase 7: Public Views

**Files to create:**

- `app/controllers/public_controller.ts`
- `resources/views/pages/public/home.edge`
- `resources/views/pages/public/roster.edge`
- `resources/views/pages/public/results.edge`

**Tasks:**

1. Create PublicController
2. Public home page with team branding
3. Roster page (player names only)
4. Results page (completed matches with outcomes)

### Phase 8: Polish

**Tasks:**

1. Consistent styling across all pages
2. Loading states for HTMx requests
3. Flash messages for success/error feedback
4. Responsive design
5. Error handling

---

## Key Files to Modify

| File                 | Changes                           |
| -------------------- | --------------------------------- |
| `app/models/user.ts` | Add role, timezone, relationships |
| `start/routes.ts`    | All application routes            |
| `start/kernel.ts`    | Register admin middleware         |

---

## Verification Plan

After each phase, verify by:

1. **Phase 1**: Start server (`node ace serve`), navigate to `/login`, log in as admin
2. **Phase 2**: Create/edit/delete players as admin, verify non-admins can't access create/edit
3. **Phase 3**: Toggle availability slots, verify they persist, check timezone display
4. **Phase 4**: Create matches, view calendar, update results
5. **Phase 5**: Mark availability for matches, verify defaults from weekly schedule
6. **Phase 6**: Add strats to maps, upload images, verify Valoplant links work
7. **Phase 7**: Visit public pages without logging in, verify data displays correctly

**Final E2E Test:**

1. Log in as admin
2. Create a player account
3. Log out, log in as player
4. Set weekly availability
5. Admin creates a match
6. Player marks availability for match
7. View public roster and results pages
