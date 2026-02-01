import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import app from '@adonisjs/core/services/app'

const AuthController = () => import('#controllers/auth_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const PlayersController = () => import('#controllers/players_controller')
const AvailabilityController = () => import('#controllers/availability_controller')
const MatchesController = () => import('#controllers/matches_controller')
const MatchAvailabilityController = () => import('#controllers/match_availability_controller')
const StratsController = () => import('#controllers/strats_controller')
const PublicController = () => import('#controllers/public_controller')
const RegistrationsController = () => import('#controllers/admin/registrations_controller')

router.get('/uploads/*', async ({ request, response }) => {
  const filePath = app.makePath('storage', request.url())
  return response.download(filePath)
})

router.get('/', [PublicController, 'home'])
router.get('/roster', [PublicController, 'roster'])
router.get('/results', [PublicController, 'results'])

router.get('/login', [AuthController, 'showLogin']).use(middleware.guest())
router.post('/login', [AuthController, 'login']).use(middleware.guest())
router.post('/logout', [AuthController, 'logout']).use(middleware.auth())

router.get('/auth/discord', [AuthController, 'discordRedirect']).use(middleware.guest())
router.get('/auth/discord/callback', [AuthController, 'discordCallback']).use(middleware.guest())

router.get('/pending-approval', [AuthController, 'showPendingApproval']).use(middleware.auth())

router
  .group(() => {
    router.get('/dashboard', [DashboardController, 'index'])

    router.get('/settings/password', [AuthController, 'showChangePassword'])
    router.put('/settings/password', [AuthController, 'changePassword'])

    router.get('/players', [PlayersController, 'index'])
    router.get('/players/new', [PlayersController, 'create']).use(middleware.admin())
    router.post('/players', [PlayersController, 'store']).use(middleware.admin())
    router.get('/players/:id', [PlayersController, 'show'])
    router.get('/players/:id/edit', [PlayersController, 'edit']).use(middleware.admin())
    router.put('/players/:id', [PlayersController, 'update']).use(middleware.admin())
    router.delete('/players/:id', [PlayersController, 'destroy']).use(middleware.admin())
    router.delete('/players/:id/logo', [PlayersController, 'destroyLogo']).use(middleware.admin())

    router.get('/availability', [AvailabilityController, 'index'])
    router.put('/availability', [AvailabilityController, 'update'])

    router.get('/matches', [MatchesController, 'index'])
    router.get('/matches/new', [MatchesController, 'create']).use(middleware.admin())
    router
      .get('/matches/check-availability', [MatchesController, 'checkAvailability'])
      .use(middleware.admin())
    router.post('/matches', [MatchesController, 'store']).use(middleware.admin())
    router.get('/matches/:id', [MatchesController, 'show'])
    router.get('/matches/:id/edit', [MatchesController, 'edit']).use(middleware.admin())
    router.put('/matches/:id', [MatchesController, 'update']).use(middleware.admin())
    router.delete('/matches/:id', [MatchesController, 'destroy']).use(middleware.admin())
    router.put('/matches/:id/result', [MatchesController, 'updateResult']).use(middleware.admin())

    router.put('/matches/:id/availability', [MatchAvailabilityController, 'update'])

    router.get('/strats', [StratsController, 'index'])
    router.get('/strats/:mapSlug', [StratsController, 'showMap'])
    router.get('/strats/:mapSlug/new', [StratsController, 'create']).use(middleware.admin())
    router.post('/strats/:mapSlug', [StratsController, 'store']).use(middleware.admin())
    router.get('/strats/:mapSlug/:id/edit', [StratsController, 'edit']).use(middleware.admin())
    router.put('/strats/:mapSlug/:id', [StratsController, 'update']).use(middleware.admin())
    router.delete('/strats/:mapSlug/:id', [StratsController, 'destroy']).use(middleware.admin())
    router
      .post('/strats/:mapSlug/:id/images', [StratsController, 'uploadImage'])
      .use(middleware.admin())
    router.delete('/strat-images/:id', [StratsController, 'deleteImage']).use(middleware.admin())

    router.get('/admin/registrations', [RegistrationsController, 'index']).use(middleware.admin())
    router
      .post('/admin/registrations/:id/approve', [RegistrationsController, 'approve'])
      .use(middleware.admin())
    router
      .post('/admin/registrations/:id/reject', [RegistrationsController, 'reject'])
      .use(middleware.admin())
  })
  .use([middleware.auth(), middleware.approved()])
