import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Match from '#models/match'
import MatchAvailability from '#models/match_availability'
import { createAdminUser, createMatch, createUser } from '../helpers/factories.js'
import { SessionClient, extractCsrfTokenFromForm } from '../helpers/api_client.js'
import { getCsrfTokenFromAppPage, loginAs } from '../helpers/session.js'
import { beginTransaction, rollbackTransaction, runMigrationsOnce } from '../helpers/test_setup.js'

test.group('Matches', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('htmx delete removes the match and returns empty response', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-delete@example.com' })
    const match = await createMatch()
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.delete(`/matches/${match.id}`, {
      headers: {
        'HX-Request': 'true',
        'x-csrf-token': csrfToken,
      },
    })

    assert.equal(response.status(), 200)
    assert.equal(response.text(), '')

    const deleted = await Match.find(match.id)
    assert.isNull(deleted)
  })

  test('htmx result update returns the status badge', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-result@example.com' })
    const match = await createMatch({
      result: null,
    })
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.put(`/matches/${match.id}/result`, {
      headers: {
        'HX-Request': 'true',
        'x-csrf-token': csrfToken,
      },
      form: {
        result: 'win',
      },
    })

    assert.equal(response.status(), 200)
    assert.include(response.text(), '<span')
    assert.notInclude(response.text(), '<!DOCTYPE html>')

    await match.refresh()
    assert.equal(match.result, 'win')
  })

  test('admin can create a match', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-create-match@example.com' })
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const createPage = await session.get('/matches/new')
    const csrfToken = extractCsrfTokenFromForm(createPage.text())
    const response = await session.post('/matches', {
      form: {
        _csrf: csrfToken,
        scheduledAt: '2026-03-01 18:30',
        opponentName: 'Team Phoenix',
        map: 'Ascent',
        matchType: 'scrim',
        notes: 'Scrim block',
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/matches')

    const created = await Match.findBy('opponentName', 'Team Phoenix')
    assert.isNotNull(created)
    assert.equal(created?.matchType, 'scrim')
    assert.equal(created?.map, 'Ascent')
  })

  test('match create validation errors on invalid payload', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-create-invalid@example.com' })
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches/new')
    const response = await session.post('/matches', {
      headers: {
        'x-csrf-token': csrfToken,
        'referer': '/matches/new',
      },
      form: {
        scheduledAt: '2026-03-01 18:30',
        opponentName: 'Invalid Match',
        map: 'Ascent',
      },
    })

    assert.equal(response.status(), 302)
    assert.notEqual(response.header('location'), '/matches')

    const redirectedForm = await session.get(response.header('location')!)
    assert.equal(redirectedForm.status(), 200)
    assert.include(redirectedForm.text(), 'Please fix the following errors:')
    assert.match(redirectedForm.text(), /match[\s_-]?type/i)

    const created = await Match.findBy('opponentName', 'Invalid Match')
    assert.isNull(created)
  })

  test('admin can update a match', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-update-match@example.com' })
    const match = await createMatch({
      opponentName: 'Team Before',
      map: 'Bind',
      notes: 'Before notes',
      matchType: 'scrim',
    })
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.put(`/matches/${match.id}`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
      form: {
        scheduledAt: '2026-04-02 13:15',
        opponentName: 'Team After',
        map: 'Haven',
        matchType: 'official',
        notes: 'After notes',
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/matches')

    await match.refresh()
    assert.equal(match.opponentName, 'Team After')
    assert.equal(match.map, 'Haven')
    assert.equal(match.matchType, 'official')
    assert.equal(match.notes, 'After notes')
  })

  test('match update validation errors on invalid payload', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-update-invalid@example.com' })
    const match = await createMatch({
      opponentName: 'Before Invalid Update',
      matchType: 'scrim',
    })
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.put(`/matches/${match.id}`, {
      headers: {
        'x-csrf-token': csrfToken,
        'referer': `/matches/${match.id}/edit`,
      },
      form: {
        scheduledAt: '2026-05-03 11:00',
        opponentName: 'After Invalid Update',
        map: 'Split',
        matchType: 'invalid-type',
      },
    })

    assert.equal(response.status(), 302)
    assert.notEqual(response.header('location'), '/matches')

    const redirectedForm = await session.get(response.header('location')!)
    assert.equal(redirectedForm.status(), 200)
    assert.include(redirectedForm.text(), 'Please fix the following errors:')
    assert.match(redirectedForm.text(), /match[\s_-]?type/i)

    await match.refresh()
    assert.equal(match.opponentName, 'Before Invalid Update')
    assert.equal(match.matchType, 'scrim')
  })

  test('player cannot access match create page', async ({ assert, client }) => {
    const player = await createUser({ email: 'player-match-create-page@example.com' })
    await createMatch({
      opponentName: 'Visible Match',
    })
    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const indexResponse = await session.get('/matches')
    assert.equal(indexResponse.status(), 200)
    assert.include(indexResponse.text(), 'Visible Match')

    const response = await session.get('/matches/new')
    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')
  })

  test('player cannot create a match', async ({ assert, client }) => {
    const player = await createUser({ email: 'player-create-match@example.com' })
    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.post('/matches', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      form: {
        scheduledAt: '2026-03-01 18:30',
        opponentName: 'Blocked Team',
        map: 'Ascent',
        matchType: 'scrim',
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')

    const created = await Match.findBy('opponentName', 'Blocked Team')
    assert.isNull(created)
  })

  test('player cannot update a match', async ({ assert, client }) => {
    const player = await createUser({ email: 'player-update-match@example.com' })
    const match = await createMatch({
      opponentName: 'Update Blocked Before',
      notes: 'Original notes',
      matchType: 'scrim',
    })
    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.put(`/matches/${match.id}`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
      form: {
        scheduledAt: '2026-05-03 11:00',
        opponentName: 'Update Blocked After',
        map: 'Split',
        matchType: 'official',
        notes: 'Should not persist',
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')

    await match.refresh()
    assert.equal(match.opponentName, 'Update Blocked Before')
    assert.equal(match.notes, 'Original notes')
    assert.equal(match.matchType, 'scrim')
  })

  test('player cannot delete a match', async ({ assert, client }) => {
    const player = await createUser({ email: 'player-delete-match@example.com' })
    const match = await createMatch()
    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.delete(`/matches/${match.id}`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')

    const existing = await Match.find(match.id)
    assert.isNotNull(existing)
  })

  test('non-htmx delete redirects to matches and removes the match', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-delete-no-hx@example.com' })
    const match = await createMatch()
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.delete(`/matches/${match.id}`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/matches')

    const deleted = await Match.find(match.id)
    assert.isNull(deleted)
  })

  test('non-htmx result update redirects to matches and persists', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-result-no-hx@example.com' })
    const match = await createMatch({
      result: null,
    })
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.put(`/matches/${match.id}/result`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
      form: {
        result: 'loss',
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/matches')

    await match.refresh()
    assert.equal(match.result, 'loss')
  })

  test('match availability update returns main and OOB fragments', async ({ assert, client }) => {
    const player = await createUser({ email: 'availability-player@example.com' })
    const match = await createMatch()
    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/matches/${match.id}`)
    const response = await session.put(`/matches/${match.id}/availability`, {
      headers: {
        'HX-Request': 'true',
        'x-csrf-token': csrfToken,
      },
      form: {
        status: 'yes',
        compact: 'false',
      },
    })

    assert.equal(response.status(), 200)
    assert.include(response.text(), 'id="team-availability"')
    assert.include(response.text(), 'id="dashboard-team-availability"')
    assert.include(response.text(), 'hx-swap-oob="true"')

    const availability = await MatchAvailability.query()
      .where('matchId', match.id)
      .where('userId', player.id)
      .first()
    assert.isNotNull(availability)
    assert.equal(availability?.status, 'yes')
  })

  test('fetch from Valorant step1 includes player after roster checkbox update', async ({
    assert,
    client,
  }) => {
    const admin = await createAdminUser({ email: 'admin-fetch-step1@example.com' })
    const player = await createUser({
      email: 'fetch-step1-player@example.com',
      fullName: 'Fetch Step Player',
      role: 'player',
      isOnRoster: false,
      trackerggUsername: null,
      agentPrefs: ['jett'],
    })
    const match = await createMatch()

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/players')
    const updateResponse = await session.put(`/players/${player.id}`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
      form: {
        'fullName': player.fullName!,
        'email': player.email,
        'role': 'player',
        'timezone': player.timezone,
        'trackerggUsername': 'RiotName#NA1',
        'isOnRoster': 'on',
        'agents[]': ['jett'],
      },
    })
    assert.equal(updateResponse.status(), 302)
    assert.equal(updateResponse.header('location'), '/players')

    const step1Response = await session.get(`/matches/${match.id}/fetch-valorant/step1`)
    assert.equal(step1Response.status(), 200)
    assert.include(step1Response.text(), 'Fetch Step Player')
    assert.include(step1Response.text(), 'RiotName#NA1')
    assert.notInclude(step1Response.text(), 'No roster players have a Riot ID configured')
  })

  test('non-htmx match availability update redirects to match page', async ({ assert, client }) => {
    const player = await createUser({ email: 'availability-player-no-hx@example.com' })
    const match = await createMatch()
    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/matches/${match.id}`)
    const response = await session.put(`/matches/${match.id}/availability`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
      form: {
        status: 'maybe',
        compact: 'false',
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), `/matches/${match.id}`)

    const availability = await MatchAvailability.query()
      .where('matchId', match.id)
      .where('userId', player.id)
      .first()
    assert.isNotNull(availability)
    assert.equal(availability?.status, 'maybe')
  })

  test('match times render correctly for two different user timezones', async ({
    assert,
    client,
  }) => {
    const scheduledAtUtc = DateTime.fromISO('2026-02-01T18:00:00.000Z', { zone: 'utc' })
    const match = await createMatch({
      scheduledAt: scheduledAtUtc,
      opponentName: 'Timezone Opponent',
    })

    const laUser = await createUser({
      email: 'timezone-la@example.com',
      timezone: 'America/Los_Angeles',
    })
    const aucklandUser = await createUser({
      email: 'timezone-auckland@example.com',
      timezone: 'Pacific/Auckland',
    })

    const laSession = new SessionClient(client)
    await loginAs(laSession, laUser.email, 'password')
    const laResponse = await laSession.get(`/matches/${match.id}`)
    const laExpectedTime = scheduledAtUtc
      .setZone('America/Los_Angeles')
      .toFormat("EEEE, dd LLLL yyyy 'at' h:mm a")
    assert.equal(laResponse.status(), 200)
    assert.include(laResponse.text(), laExpectedTime)

    const aucklandSession = new SessionClient(client)
    await loginAs(aucklandSession, aucklandUser.email, 'password')
    const aucklandResponse = await aucklandSession.get(`/matches/${match.id}`)
    const aucklandExpectedTime = scheduledAtUtc
      .setZone('Pacific/Auckland')
      .toFormat("EEEE, dd LLLL yyyy 'at' h:mm a")
    assert.equal(aucklandResponse.status(), 200)
    assert.include(aucklandResponse.text(), aucklandExpectedTime)
    assert.notEqual(laExpectedTime, aucklandExpectedTime)
  })
})
