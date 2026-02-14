import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import PlayerNudge from '#models/player_nudge'
import WeeklyAvailability from '#models/weekly_availability'
import { createAdminUser, createUser } from '../helpers/factories.js'
import { SessionClient } from '../helpers/api_client.js'
import { getCsrfTokenFromAppPage, loginAs } from '../helpers/session.js'
import { beginTransaction, rollbackTransaction, runMigrationsOnce } from '../helpers/test_setup.js'

const postNudge = async (session: SessionClient, playerId: number) => {
  const csrfToken = await getCsrfTokenFromAppPage(session, '/players')
  return session.post(`/players/${playerId}/nudge`, {
    headers: {
      'HX-Request': 'true',
      'x-csrf-token': csrfToken,
    },
  })
}

test.group('Players', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('admin players list shows Last Login and Never states', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'players-last-login-admin@example.com',
      timezone: 'America/Los_Angeles',
    })
    const activePlayer = await createUser({
      email: 'players-last-login-active@example.com',
      fullName: 'Active Player',
      lastLoginAt: DateTime.fromISO('2025-01-02T03:04:00.000Z', { zone: 'utc' }),
    })
    await createUser({
      email: 'players-last-login-never@example.com',
      fullName: 'Never Logged',
      lastLoginAt: null,
    })

    const expectedLastLogin = activePlayer
      .lastLoginAt!.setZone('America/Los_Angeles')
      .toFormat('dd LLL yyyy h:mm a')

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const response = await session.get('/players')
    assert.equal(response.status(), 200)
    assert.include(response.text(), 'Last Login')
    assert.include(response.text(), expectedLastLogin)
    assert.include(response.text(), 'Never')
    assert.notInclude(response.text(), 'player-nudge-controls-')
  })

  test('admin can view player details page with nudge controls', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'players-detail-admin@example.com',
    })
    const target = await createUser({
      email: 'players-detail-target@example.com',
      fullName: 'Detail Target',
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const response = await session.get(`/players/${target.id}`)
    assert.equal(response.status(), 200)
    assert.include(response.text(), 'Edit Player')
    assert.include(response.text(), `id="player-nudge-controls-${target.id}"`)
    assert.include(response.text(), `hx-post="/players/${target.id}/nudge"`)
  })

  test('non-admin cannot trigger player nudge endpoint', async ({ assert, client }) => {
    const player = await createUser({
      email: 'players-nudge-non-admin@example.com',
    })
    const target = await createUser({
      email: 'players-nudge-target-non-admin@example.com',
      discordId: '123456789',
      discordUsername: 'target-user',
    })

    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/players')
    const response = await session.post(`/players/${target.id}/nudge`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')
  })

  test('admin can nudge player with missing data and it is audited', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'players-nudge-admin@example.com',
    })
    const target = await createUser({
      email: 'players-nudge-target@example.com',
      discordId: '987654321',
      discordUsername: 'missing-data-player',
      agentPrefs: [],
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const response = await postNudge(session, target.id)
    assert.equal(response.status(), 200)
    assert.include(response.text(), 'Nudge sent just now.')

    const nudge = await PlayerNudge.query().where('userId', target.id).orderBy('id', 'desc').first()
    assert.isNotNull(nudge)
    assert.equal(nudge!.status, 'sent')
    assert.equal(nudge!.errorCode, null)
    assert.equal(nudge!.missingAvailability, true)
    assert.equal(nudge!.missingAgents, true)
    assert.isNotNull(nudge!.sentAt)
  })

  test('nudge is blocked by cooldown after a successful send', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'players-nudge-cooldown-admin@example.com',
    })
    const target = await createUser({
      email: 'players-nudge-cooldown-target@example.com',
      discordId: '222333444',
      discordUsername: 'cooldown-player',
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const firstResponse = await postNudge(session, target.id)
    assert.equal(firstResponse.status(), 200)

    const secondResponse = await postNudge(session, target.id)
    assert.equal(secondResponse.status(), 200)
    assert.match(secondResponse.text(), /On cooldown/i)

    const latestNudge = await PlayerNudge.query()
      .where('userId', target.id)
      .orderBy('id', 'desc')
      .first()
    assert.isNotNull(latestNudge)
    assert.equal(latestNudge!.status, 'blocked')
    assert.equal(latestNudge!.errorCode, 'cooldown_active')
  })

  test('nudge is blocked when target has no linked Discord account', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'players-nudge-no-discord-admin@example.com',
    })
    const target = await createUser({
      email: 'players-nudge-no-discord-target@example.com',
      discordId: null,
      discordUsername: null,
      agentPrefs: [],
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const response = await postNudge(session, target.id)
    assert.equal(response.status(), 200)
    assert.match(response.text(), /no linked Discord/i)

    const latestNudge = await PlayerNudge.query()
      .where('userId', target.id)
      .orderBy('id', 'desc')
      .first()
    assert.isNotNull(latestNudge)
    assert.equal(latestNudge!.status, 'blocked')
    assert.equal(latestNudge!.errorCode, 'missing_discord_id')
  })

  test('nudge is blocked when target has no missing profile data', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'players-nudge-complete-admin@example.com',
    })
    const target = await createUser({
      email: 'players-nudge-complete-target@example.com',
      discordId: '111222333',
      discordUsername: 'complete-player',
      agentPrefs: ['jett'],
    })

    await WeeklyAvailability.create({
      userId: target.id,
      dayOfWeek: 1,
      hour: 18,
      isAvailable: true,
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const response = await postNudge(session, target.id)
    assert.equal(response.status(), 200)
    assert.match(response.text(), /No nudge needed/i)

    const latestNudge = await PlayerNudge.query()
      .where('userId', target.id)
      .orderBy('id', 'desc')
      .first()
    assert.isNotNull(latestNudge)
    assert.equal(latestNudge!.status, 'blocked')
    assert.equal(latestNudge!.errorCode, 'no_missing_data')
    assert.equal(latestNudge!.missingAvailability, false)
    assert.equal(latestNudge!.missingAgents, false)
  })

  test('failed Discord DM is recorded as failed nudge', async ({ assert, client }) => {
    const originalMode = process.env.DISCORD_DM_TEST_MODE
    process.env.DISCORD_DM_TEST_MODE = 'fail'

    try {
      const admin = await createAdminUser({
        email: 'players-nudge-failure-admin@example.com',
      })
      const target = await createUser({
        email: 'players-nudge-failure-target@example.com',
        discordId: '999888777',
        discordUsername: 'failure-player',
      })

      const session = new SessionClient(client)
      await loginAs(session, admin.email, 'password')

      const response = await postNudge(session, target.id)
      assert.equal(response.status(), 200)
      assert.match(response.text(), /Failed to send nudge/i)

      const latestNudge = await PlayerNudge.query()
        .where('userId', target.id)
        .orderBy('id', 'desc')
        .first()
      assert.isNotNull(latestNudge)
      assert.equal(latestNudge!.status, 'failed')
      assert.equal(latestNudge!.errorCode, 'discord_dm_test_failure')
    } finally {
      if (originalMode === undefined) {
        delete process.env.DISCORD_DM_TEST_MODE
      } else {
        process.env.DISCORD_DM_TEST_MODE = originalMode
      }
    }
  })

  test('missing Discord bot token returns blocked message (not 502)', async ({
    assert,
    client,
  }) => {
    const originalMode = process.env.DISCORD_DM_TEST_MODE
    process.env.DISCORD_DM_TEST_MODE = 'bot_token_missing'

    try {
      const admin = await createAdminUser({
        email: 'players-nudge-no-bot-token-admin@example.com',
      })
      const target = await createUser({
        email: 'players-nudge-no-bot-token-target@example.com',
        discordId: '1010101010',
        discordUsername: 'token-missing-player',
      })

      const session = new SessionClient(client)
      await loginAs(session, admin.email, 'password')

      const response = await postNudge(session, target.id)
      assert.equal(response.status(), 200)
      assert.match(response.text(), /DISCORD_BOT_TOKEN is not configured/i)

      const latestNudge = await PlayerNudge.query()
        .where('userId', target.id)
        .orderBy('id', 'desc')
        .first()
      assert.isNotNull(latestNudge)
      assert.equal(latestNudge!.status, 'blocked')
      assert.equal(latestNudge!.errorCode, 'discord_bot_token_missing')
    } finally {
      if (originalMode === undefined) {
        delete process.env.DISCORD_DM_TEST_MODE
      } else {
        process.env.DISCORD_DM_TEST_MODE = originalMode
      }
    }
  })
})
