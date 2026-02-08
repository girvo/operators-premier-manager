import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import MatchAvailability from '#models/match_availability'
import MatchAvailabilityNudge from '#models/match_availability_nudge'
import MatchAvailabilityResponseTokenService from '#services/match_availability_response_token_service'
import { createAdminUser, createMatch, createUser } from '../helpers/factories.js'
import { SessionClient } from '../helpers/api_client.js'
import { getCsrfTokenFromAppPage, loginAs } from '../helpers/session.js'
import { beginTransaction, rollbackTransaction, runMigrationsOnce } from '../helpers/test_setup.js'

const postMatchNudge = async (session: SessionClient, matchId: number, force = false) => {
  const csrfToken = await getCsrfTokenFromAppPage(session, `/matches/${matchId}`)
  return session.post(`/matches/${matchId}/nudge-non-responders`, {
    headers: {
      'x-csrf-token': csrfToken,
    },
    form: force ? { force: '1' } : {},
  })
}

test.group('Match availability nudges', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('admin can trigger nudge action and only non-responders are targeted', async ({
    assert,
    client,
  }) => {
    const admin = await createAdminUser({
      email: 'match-nudge-admin@example.com',
    })
    const match = await createMatch({
      scheduledAt: DateTime.now().plus({ days: 2 }),
    })

    const eligible = await createUser({
      email: 'match-nudge-eligible@example.com',
      discordId: '10001',
    })
    const alreadyResponded = await createUser({
      email: 'match-nudge-responded@example.com',
      discordId: '10002',
    })
    await createUser({
      email: 'match-nudge-missing-discord@example.com',
      discordId: null,
    })
    await createUser({
      email: 'match-nudge-not-on-roster@example.com',
      discordId: '10003',
      isOnRoster: false,
    })
    await createUser({
      email: 'match-nudge-not-approved@example.com',
      discordId: '10004',
      approvalStatus: 'pending',
    })

    await MatchAvailability.create({
      matchId: match.id,
      userId: alreadyResponded.id,
      status: 'yes',
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const response = await postMatchNudge(session, match.id)
    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), `/matches/${match.id}`)

    const nudges = await MatchAvailabilityNudge.query()
      .where('matchId', match.id)
      .orderBy('id', 'asc')
    assert.lengthOf(nudges, 1)
    assert.equal(nudges[0].userId, eligible.id)
    assert.equal(nudges[0].status, 'sent')
    assert.isNotNull(nudges[0].sentAt)
  })

  test('non-admin cannot trigger match nudge action', async ({ assert, client }) => {
    const player = await createUser({
      email: 'match-nudge-player@example.com',
    })
    const match = await createMatch()
    await createUser({
      email: 'match-nudge-target@example.com',
      discordId: '20001',
    })

    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const response = await postMatchNudge(session, match.id)
    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')

    const nudgeCount = await MatchAvailabilityNudge.query()
      .where('matchId', match.id)
      .count('* as total')
      .first()
    assert.equal(Number(nudgeCount?.$extras.total ?? 0), 0)
  })

  test('match nudge skips recent nudges unless forced', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'match-nudge-cooldown-admin@example.com',
    })
    const match = await createMatch({
      scheduledAt: DateTime.now().plus({ days: 3 }),
    })
    const target = await createUser({
      email: 'match-nudge-cooldown-target@example.com',
      discordId: '30001',
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const first = await postMatchNudge(session, match.id)
    assert.equal(first.status(), 302)

    const second = await postMatchNudge(session, match.id)
    assert.equal(second.status(), 302)

    const third = await postMatchNudge(session, match.id, true)
    assert.equal(third.status(), 302)

    const attempts = await MatchAvailabilityNudge.query()
      .where('matchId', match.id)
      .where('userId', target.id)
      .orderBy('id', 'asc')
    assert.lengthOf(attempts, 3)
    assert.equal(attempts[0].status, 'sent')
    assert.equal(attempts[1].status, 'blocked')
    assert.equal(attempts[1].errorCode, 'cooldown_active')
    assert.equal(attempts[2].status, 'sent')
    assert.equal(Boolean(attempts[2].forced), true)
  })

  test('token links update match availability for yes, maybe, and no', async ({
    assert,
    client,
  }) => {
    const player = await createUser({
      email: 'match-token-player@example.com',
    })
    const match = await createMatch({
      scheduledAt: DateTime.now().plus({ days: 1 }),
    })
    const tokenService = new MatchAvailabilityResponseTokenService()

    for (const status of ['yes', 'maybe', 'no'] as const) {
      const token = tokenService.createToken({
        matchId: match.id,
        userId: player.id,
        status,
        expiresAt: DateTime.now().plus({ hours: 4 }),
      })

      const response = await client.get(`/match-availability/respond/${token}`)
      assert.equal(response.status(), 200)
      assert.include(response.text(), 'Availability Updated')

      const availability = await MatchAvailability.query()
        .where('matchId', match.id)
        .where('userId', player.id)
        .first()
      assert.isNotNull(availability)
      assert.equal(availability!.status, status)
    }
  })

  test('invalid and expired tokens are rejected', async ({ assert, client }) => {
    const player = await createUser({
      email: 'match-token-invalid-player@example.com',
    })
    const match = await createMatch({
      scheduledAt: DateTime.now().plus({ days: 1 }),
    })
    const tokenService = new MatchAvailabilityResponseTokenService()

    const invalidResponse = await client.get('/match-availability/respond/not-a-valid-token')
    assert.equal(invalidResponse.status(), 400)
    assert.include(invalidResponse.text(), 'Invalid Link')

    const expiredToken = tokenService.createToken({
      matchId: match.id,
      userId: player.id,
      status: 'yes',
      expiresAt: DateTime.now().minus({ minutes: 1 }),
    })
    const expiredResponse = await client.get(`/match-availability/respond/${expiredToken}`)
    assert.equal(expiredResponse.status(), 410)
    assert.include(expiredResponse.text(), 'Link Expired')
  })

  test('token cannot update availability for past matches', async ({ assert, client }) => {
    const player = await createUser({
      email: 'match-token-past-player@example.com',
    })
    const pastMatch = await createMatch({
      scheduledAt: DateTime.now().minus({ minutes: 30 }),
    })
    const tokenService = new MatchAvailabilityResponseTokenService()

    const token = tokenService.createToken({
      matchId: pastMatch.id,
      userId: player.id,
      status: 'no',
      expiresAt: DateTime.now().plus({ hours: 3 }),
    })

    const response = await client.get(`/match-availability/respond/${token}`)
    assert.equal(response.status(), 410)
    assert.include(response.text(), 'Match Already Passed')

    const availability = await MatchAvailability.query()
      .where('matchId', pastMatch.id)
      .where('userId', player.id)
      .first()
    assert.isNull(availability)
  })
})
