import { test } from '@japa/runner'
import MapCompSlot from '#models/map_comp_slot'
import MapCompSuggestion from '#models/map_comp_suggestion'
import MapCompSuggestionSlot from '#models/map_comp_suggestion_slot'
import { createAdminUser, createUser, createMap } from '../helpers/factories.js'
import { SessionClient } from '../helpers/api_client.js'
import { getCsrfTokenFromAppPage, loginAs } from '../helpers/session.js'
import { beginTransaction, rollbackTransaction, runMigrationsOnce } from '../helpers/test_setup.js'

const AGENT_KEYS = ['jett', 'sage', 'omen', 'sova', 'killjoy']

const createRosterPlayers = async () => {
  const players = []
  for (let i = 0; i < 5; i++) {
    const player = await createUser({
      email: `comp-player-${i}-${Date.now()}@example.com`,
      fullName: `Player ${i}`,
      isOnRoster: true,
      agentPrefs: [AGENT_KEYS[i], 'viper', 'breach'],
    })
    players.push(player)
  }
  return players
}

const createComp = async (mapId: number) => {
  for (const [i, AGENT_KEY] of AGENT_KEYS.entries()) {
    await MapCompSlot.create({
      mapId,
      agentKey: AGENT_KEY,
      slotOrder: i + 1,
    })
  }
}

test.group('Comps', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('comp section renders on map page', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: `comp-view-${Date.now()}@example.com` })
    const map = await createMap({ slug: `comp-view-${Date.now()}` })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const response = await session.get(`/strats/${map.slug}`)
    assert.equal(response.status(), 200)
    assert.include(response.text(), 'Agent Comp')
    assert.include(response.text(), 'No comp set')
  })

  test('admin can set up a comp', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: `comp-setup-${Date.now()}@example.com` })
    const map = await createMap({ slug: `comp-setup-${Date.now()}` })
    await createRosterPlayers()

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}/comp/edit`)

    const form: Record<string, any> = {}
    for (let i = 0; i < 5; i++) {
      form[`agents[${i}]`] = AGENT_KEYS[i]
    }

    const response = await session.put(`/strats/${map.slug}/comp`, {
      headers: { 'x-csrf-token': csrfToken },
      form,
    })

    assert.equal(response.status(), 302)
    assert.include(response.header('location'), `/strats/${map.slug}`)

    const slots = await MapCompSlot.query().where('mapId', map.id).orderBy('slotOrder', 'asc')
    assert.equal(slots.length, 5)
    assert.equal(slots[0].agentKey, 'jett')
  })

  test('admin cannot create comp with duplicate agents', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: `comp-dup-agent-${Date.now()}@example.com` })
    const map = await createMap({ slug: `comp-dup-agent-${Date.now()}` })
    await createRosterPlayers()

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}/comp/edit`)

    const form: Record<string, any> = {}
    for (let i = 0; i < 5; i++) {
      form[`agents[${i}]`] = 'viper' // all same agent
    }

    const response = await session.put(`/strats/${map.slug}/comp`, {
      headers: { 'x-csrf-token': csrfToken },
      form,
    })

    assert.equal(response.status(), 302)
    assert.include(response.header('location')!, `/strats/${map.slug}/comp/edit`)

    const slots = await MapCompSlot.query().where('mapId', map.id)
    assert.equal(slots.length, 0)
  })

  test('player can submit a suggestion', async ({ assert, client }) => {
    const player = await createUser({
      email: `comp-suggest-${Date.now()}@example.com`,
      agentPrefs: ['jett', 'viper', 'breach'],
      isOnRoster: true,
    })
    const map = await createMap({ slug: `comp-suggest-${Date.now()}` })
    await createRosterPlayers()
    await createComp(map.id)

    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}/comp/suggest`)

    // Change first agent from jett to viper
    const form: Record<string, any> = { note: 'I think viper is better here' }
    for (let i = 0; i < 5; i++) {
      form[`agents[${i}]`] = i === 0 ? 'viper' : AGENT_KEYS[i]
    }

    const response = await session.post(`/strats/${map.slug}/comp/suggestions`, {
      headers: { 'x-csrf-token': csrfToken },
      form,
    })

    assert.equal(response.status(), 302)

    const suggestion = await MapCompSuggestion.query()
      .where('mapId', map.id)
      .preload('slots')
      .firstOrFail()

    assert.equal(suggestion.status, 'pending')
    assert.equal(suggestion.note, 'I think viper is better here')
    assert.equal(suggestion.slots.length, 5)
    assert.equal(suggestion.slots[0].agentKey, 'viper')
  })

  test('suggestion with no changes is rejected', async ({ assert, client }) => {
    const player = await createUser({
      email: `comp-nochange-${Date.now()}@example.com`,
      isOnRoster: true,
    })
    const map = await createMap({ slug: `comp-nochange-${Date.now()}` })
    await createRosterPlayers()
    await createComp(map.id)

    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}/comp/suggest`)

    // Submit unchanged
    const form: Record<string, any> = {}
    for (let i = 0; i < 5; i++) {
      form[`agents[${i}]`] = AGENT_KEYS[i]
    }

    const response = await session.post(`/strats/${map.slug}/comp/suggestions`, {
      headers: { 'x-csrf-token': csrfToken },
      form,
    })

    assert.equal(response.status(), 302)
    assert.include(response.header('location')!, `/strats/${map.slug}`)

    const suggestions = await MapCompSuggestion.query().where('mapId', map.id)
    assert.equal(suggestions.length, 0)
  })

  test('admin can accept a suggestion', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: `comp-accept-${Date.now()}@example.com` })
    const map = await createMap({ slug: `comp-accept-${Date.now()}` })
    await createRosterPlayers()
    await createComp(map.id)

    // Create a suggestion (full 5 agents, with viper replacing jett)
    const suggestion = await MapCompSuggestion.create({
      mapId: map.id,
      suggestedBy: admin.id,
      status: 'pending',
      note: 'Switch to viper',
    })
    const suggestedAgents = ['viper', 'sage', 'omen', 'sova', 'killjoy']
    for (const [i, suggestedAgent] of suggestedAgents.entries()) {
      await MapCompSuggestionSlot.create({
        suggestionId: suggestion.id,
        agentKey: suggestedAgent,
        slotOrder: i + 1,
      })
    }

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}`)

    const response = await session.put(
      `/strats/${map.slug}/comp/suggestions/${suggestion.id}/accept`,
      {
        headers: { 'x-csrf-token': csrfToken },
      }
    )

    assert.equal(response.status(), 302)

    // Check the comp was replaced with suggestion's agents
    const slots = await MapCompSlot.query().where('mapId', map.id).orderBy('slotOrder', 'asc')
    assert.equal(slots.length, 5)
    assert.equal(slots[0].agentKey, 'viper')

    // Check suggestion was marked accepted
    await suggestion.refresh()
    assert.equal(suggestion.status, 'accepted')
  })

  test('rejecting last suggestion returns empty pending section', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: `comp-reject-${Date.now()}@example.com` })
    const map = await createMap({ slug: `comp-reject-${Date.now()}` })
    await createRosterPlayers()
    await createComp(map.id)

    const suggestion = await MapCompSuggestion.create({
      mapId: map.id,
      suggestedBy: admin.id,
      status: 'pending',
      note: null,
    })
    await MapCompSuggestionSlot.create({
      suggestionId: suggestion.id,
      agentKey: 'viper',
      slotOrder: 1,
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}`)

    const response = await session.put(
      `/strats/${map.slug}/comp/suggestions/${suggestion.id}/reject`,
      {
        headers: {
          'x-csrf-token': csrfToken,
          'HX-Request': 'true',
        },
      }
    )

    assert.equal(response.status(), 200)
    // HTMX replaces #pending-suggestions via outerHTML — no pending left means no header
    assert.notInclude(response.text(), 'Pending')

    await suggestion.refresh()
    assert.equal(suggestion.status, 'rejected')
  })

  test('rejecting one of two suggestions returns remaining suggestion', async ({
    assert,
    client,
  }) => {
    const admin = await createAdminUser({ email: `comp-reject2-${Date.now()}@example.com` })
    const map = await createMap({ slug: `comp-reject2-${Date.now()}` })
    await createRosterPlayers()
    await createComp(map.id)

    const suggestion1 = await MapCompSuggestion.create({
      mapId: map.id,
      suggestedBy: admin.id,
      status: 'pending',
      note: 'first',
    })
    await MapCompSuggestionSlot.create({
      suggestionId: suggestion1.id,
      agentKey: 'viper',
      slotOrder: 1,
    })

    const suggestion2 = await MapCompSuggestion.create({
      mapId: map.id,
      suggestedBy: admin.id,
      status: 'pending',
      note: 'second',
    })
    await MapCompSuggestionSlot.create({
      suggestionId: suggestion2.id,
      agentKey: 'breach',
      slotOrder: 1,
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}`)

    // Reject the first suggestion
    const response = await session.put(
      `/strats/${map.slug}/comp/suggestions/${suggestion1.id}/reject`,
      {
        headers: {
          'x-csrf-token': csrfToken,
          'HX-Request': 'true',
        },
      }
    )

    assert.equal(response.status(), 200)
    // Response should still show the remaining suggestion
    assert.include(response.text(), 'Pending')
    assert.include(response.text(), 'second')
    assert.notInclude(response.text(), 'first')
  })

  test('non-admin cannot access comp edit page', async ({ assert, client }) => {
    const player = await createUser({ email: `comp-noedit-${Date.now()}@example.com` })
    const map = await createMap({ slug: `comp-noedit-${Date.now()}` })

    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const response = await session.get(`/strats/${map.slug}/comp/edit`)
    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')
  })

  test('non-admin cannot accept a suggestion', async ({ assert, client }) => {
    const player = await createUser({ email: `comp-noacc-${Date.now()}@example.com` })
    const map = await createMap({ slug: `comp-noacc-${Date.now()}` })
    await createRosterPlayers()
    await createComp(map.id)

    const suggestion = await MapCompSuggestion.create({
      mapId: map.id,
      suggestedBy: player.id,
      status: 'pending',
      note: null,
    })

    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}`)

    const response = await session.put(
      `/strats/${map.slug}/comp/suggestions/${suggestion.id}/accept`,
      {
        headers: { 'x-csrf-token': csrfToken },
      }
    )

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')
  })
})
