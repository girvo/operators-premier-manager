import { test } from '@japa/runner'
import ValorantApiService from '#services/valorant_api_service'

// v4 match factory
function makeHenrikV4Match(overrides: {
  match_id: string
  queueId: string
  queueName?: string
  map?: string
  startedAt?: string
  playerName?: string
  playerTag?: string
  playerTeam?: 'Red' | 'Blue'
  redWon?: number
  blueWon?: number
  hasPremierRoster?: boolean
}) {
  const name = overrides.playerName ?? 'TestPlayer'
  const tag = overrides.playerTag ?? 'NA1'
  const startedAt = overrides.startedAt ?? '2026-04-01T12:00:00.000Z'
  const queueName = overrides.queueName ?? overrides.queueId

  const redTeam = {
    team_id: 'Red',
    rounds: { won: overrides.redWon ?? 13, lost: overrides.blueWon ?? 7 },
    won: (overrides.redWon ?? 13) > (overrides.blueWon ?? 7),
    ...(overrides.hasPremierRoster
      ? { premier_roster: { id: 'premier-team-red', name: 'Team Red', tag: 'TR' } }
      : {}),
  }

  const blueTeam = {
    team_id: 'Blue',
    rounds: { won: overrides.blueWon ?? 7, lost: overrides.redWon ?? 13 },
    won: (overrides.blueWon ?? 7) > (overrides.redWon ?? 13),
  }

  return {
    metadata: {
      match_id: overrides.match_id,
      map: { id: 'map-id', name: overrides.map ?? 'Ascent' },
      started_at: startedAt,
      queue: { id: overrides.queueId, name: queueName },
      premier: overrides.hasPremierRoster ? { id: 'premier-match' } : null,
      region: 'ap',
    },
    teams: [redTeam, blueTeam],
    players: [{ puuid: 'puuid-1', name, tag, team_id: overrides.playerTeam ?? 'Red' }],
  }
}

function makeV4ApiResponse(matches: ReturnType<typeof makeHenrikV4Match>[]) {
  return { status: 200, data: matches }
}

test.group('ValorantApiService.getRecentMatches', () => {
  test('without showAll, fetches 3 pages of matches', async ({ assert }) => {
    const fetchCalls: string[] = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = async (input: string | URL | Request, _init?: RequestInit) => {
      const url = input.toString()
      fetchCalls.push(url)

      const body = makeV4ApiResponse([
        makeHenrikV4Match({ match_id: 'premier-1', queueId: 'premier', hasPremierRoster: true }),
        makeHenrikV4Match({ match_id: 'dm-1', queueId: 'deathmatch' }),
      ])

      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      const results = await ValorantApiService.getRecentMatches('TestPlayer', 'NA1', 'ap', false)

      // Should fetch 3 pages (start=0, start=10, start=20)
      assert.lengthOf(fetchCalls, 3)
      assert.isTrue(fetchCalls.every((u) => u.includes('v4/matches')))
      assert.isTrue(fetchCalls.every((u) => u.includes('size=10')))
      assert.isTrue(fetchCalls.some((u) => u.includes('start=0')))
      assert.isTrue(fetchCalls.some((u) => u.includes('start=10')))
      assert.isTrue(fetchCalls.some((u) => u.includes('start=20')))

      // Should filter to only Premier (not Other)
      assert.lengthOf(results, 1)
      assert.equal(results[0].matchType, 'Premier')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('with showAll, fetches 6 pages (3 default + 3 custom)', async ({ assert }) => {
    const fetchCalls: string[] = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = async (input: string | URL | Request, _init?: RequestInit) => {
      const url = input.toString()
      fetchCalls.push(url)

      if (url.includes('mode=custom')) {
        const body = makeV4ApiResponse([
          makeHenrikV4Match({ match_id: 'custom-1', queueId: 'custom' }),
          makeHenrikV4Match({ match_id: 'custom-2', queueId: 'custom' }),
        ])
        return new Response(JSON.stringify(body), { status: 200 })
      }

      const body = makeV4ApiResponse([
        makeHenrikV4Match({ match_id: 'premier-1', queueId: 'premier', hasPremierRoster: true }),
        makeHenrikV4Match({ match_id: 'dm-1', queueId: 'deathmatch' }),
      ])
      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      const results = await ValorantApiService.getRecentMatches('TestPlayer', 'NA1', 'ap', true)

      // Should fetch 6 pages (3 default + 3 custom)
      assert.lengthOf(fetchCalls, 6)
      assert.isTrue(fetchCalls.some((u) => u.includes('mode=custom')))
      assert.isTrue(fetchCalls.some((u) => !u.includes('mode=')))

      const matchTypes = results.map((r) => r.matchType)
      assert.include(matchTypes, 'Premier')
      assert.include(matchTypes, 'Custom')
      assert.include(matchTypes, 'Other')
      // 1 Premier + 2 Custom + 1 Deathmatch (Other) = 4 matches
      assert.lengthOf(results, 4)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('deduplicates matches from multiple pages', async ({ assert }) => {
    const originalFetch = globalThis.fetch
    const sharedMatch = makeHenrikV4Match({
      match_id: 'shared-1',
      queueId: 'premier',
      hasPremierRoster: true,
    })

    globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
      // Return same match on multiple pages
      const body = makeV4ApiResponse([sharedMatch])
      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      const results = await ValorantApiService.getRecentMatches('TestPlayer', 'NA1', 'ap', false)

      const matchIds = results.map((r) => r.matchId)
      assert.lengthOf(matchIds, 1)
      assert.include(matchIds, 'shared-1')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('filters matches by date range (daysBack parameter)', async ({ assert }) => {
    const originalFetch = globalThis.fetch
    const now = new Date()
    const withinRange = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    const outsideRange = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000) // 20 days ago

    globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
      const body = makeV4ApiResponse([
        makeHenrikV4Match({
          match_id: 'recent-1',
          queueId: 'premier',
          hasPremierRoster: true,
          startedAt: withinRange.toISOString(),
        }),
        makeHenrikV4Match({
          match_id: 'old-1',
          queueId: 'premier',
          hasPremierRoster: true,
          startedAt: outsideRange.toISOString(),
        }),
      ])
      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      // Default daysBack is 14
      const results = await ValorantApiService.getRecentMatches(
        'TestPlayer',
        'NA1',
        'ap',
        false,
        14
      )

      // Should only include the match within range
      assert.lengthOf(results, 1)
      assert.equal(results[0].matchId, 'recent-1')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('excludes matches older than daysBack threshold', async ({ assert }) => {
    const originalFetch = globalThis.fetch
    const now = new Date()

    globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
      // All matches are 20+ days old
      const oldDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)
      const body = makeV4ApiResponse([
        makeHenrikV4Match({
          match_id: 'old-1',
          queueId: 'premier',
          hasPremierRoster: true,
          startedAt: oldDate.toISOString(),
        }),
      ])
      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      const results = await ValorantApiService.getRecentMatches(
        'TestPlayer',
        'NA1',
        'ap',
        false,
        14
      )

      assert.lengthOf(results, 0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('custom daysBack parameter works', async ({ assert }) => {
    const originalFetch = globalThis.fetch
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)

    globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => {
      const body = makeV4ApiResponse([
        makeHenrikV4Match({
          match_id: 'match-7days',
          queueId: 'premier',
          hasPremierRoster: true,
          startedAt: sevenDaysAgo.toISOString(),
        }),
        makeHenrikV4Match({
          match_id: 'match-10days',
          queueId: 'premier',
          hasPremierRoster: true,
          startedAt: tenDaysAgo.toISOString(),
        }),
      ])
      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      // Request only 8 days back
      const results = await ValorantApiService.getRecentMatches('TestPlayer', 'NA1', 'ap', false, 8)

      assert.lengthOf(results, 1)
      assert.equal(results[0].matchId, 'match-7days')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
