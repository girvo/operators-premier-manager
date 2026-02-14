import { test } from '@japa/runner'
import ValorantApiService from '#services/valorant_api_service'

function makeHenrikMatch(overrides: {
  matchid: string
  mode: string
  queue?: string | null
  mode_id?: string
  map?: string
  playerName?: string
  playerTag?: string
  playerTeam?: string
  redWon?: number
  blueWon?: number
  premier_info?: { tournament_id: string | null; matchup_id: string | null }
}) {
  const name = overrides.playerName ?? 'TestPlayer'
  const tag = overrides.playerTag ?? 'NA1'
  return {
    metadata: {
      matchid: overrides.matchid,
      map: overrides.map ?? 'Ascent',
      game_start_patched: '2025-01-01 12:00:00',
      mode: overrides.mode,
      mode_id: overrides.mode_id ?? overrides.mode.toLowerCase(),
      queue: overrides.queue ?? overrides.mode,
      region: 'ap',
      ...(overrides.premier_info ? { premier_info: overrides.premier_info } : {}),
    },
    teams: {
      red: { rounds_won: overrides.redWon ?? 13, rounds_lost: overrides.blueWon ?? 7 },
      blue: { rounds_won: overrides.blueWon ?? 7, rounds_lost: overrides.redWon ?? 13 },
    },
    players: {
      all_players: [
        { puuid: 'puuid-1', name, tag, team: overrides.playerTeam ?? 'Red' },
      ],
    },
  }
}

function makeApiResponse(matches: ReturnType<typeof makeHenrikMatch>[]) {
  return { status: 200, data: matches }
}

test.group('ValorantApiService.getRecentMatches', () => {
  test('without showAll, only one API call is made (no custom games)', async ({ assert }) => {
    const fetchCalls: string[] = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input.toString()
      fetchCalls.push(url)

      const body = makeApiResponse([
        makeHenrikMatch({ matchid: 'premier-1', mode: 'Premier', premier_info: { tournament_id: 'tid', matchup_id: null } }),
        makeHenrikMatch({ matchid: 'dm-1', mode: 'Deathmatch' }),
      ])

      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      const results = await ValorantApiService.getRecentMatches('TestPlayer', 'NA1', 'ap', false)

      assert.lengthOf(fetchCalls, 1)
      assert.notInclude(fetchCalls[0], 'mode=custom')

      assert.lengthOf(results, 1)
      assert.equal(results[0].matchType, 'Premier')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('with showAll, two API calls are made and custom games are included', async ({ assert }) => {
    const fetchCalls: string[] = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input.toString()
      fetchCalls.push(url)

      if (url.includes('mode=custom')) {
        const body = makeApiResponse([
          makeHenrikMatch({ matchid: 'custom-1', mode: 'Custom', queue: 'Custom' }),
          makeHenrikMatch({ matchid: 'custom-2', mode: 'Custom', queue: 'Custom' }),
        ])
        return new Response(JSON.stringify(body), { status: 200 })
      }

      const body = makeApiResponse([
        makeHenrikMatch({ matchid: 'premier-1', mode: 'Premier', premier_info: { tournament_id: 'tid', matchup_id: null } }),
        makeHenrikMatch({ matchid: 'dm-1', mode: 'Deathmatch' }),
      ])
      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      const results = await ValorantApiService.getRecentMatches('TestPlayer', 'NA1', 'ap', true)

      assert.lengthOf(fetchCalls, 2)
      assert.isTrue(fetchCalls.some((u) => u.includes('mode=custom')))
      assert.isTrue(fetchCalls.some((u) => !u.includes('mode=')))

      const matchTypes = results.map((r) => r.matchType)
      assert.include(matchTypes, 'Premier')
      assert.include(matchTypes, 'Custom')
      assert.include(matchTypes, 'Other')
      assert.lengthOf(results, 4)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('with showAll, duplicate matches from custom endpoint are deduplicated', async ({ assert }) => {
    const originalFetch = globalThis.fetch
    const sharedMatch = makeHenrikMatch({ matchid: 'shared-1', mode: 'Custom', queue: 'Custom' })

    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input.toString()

      if (url.includes('mode=custom')) {
        const body = makeApiResponse([
          sharedMatch,
          makeHenrikMatch({ matchid: 'custom-only', mode: 'Custom', queue: 'Custom' }),
        ])
        return new Response(JSON.stringify(body), { status: 200 })
      }

      const body = makeApiResponse([sharedMatch])
      return new Response(JSON.stringify(body), { status: 200 })
    }

    try {
      const results = await ValorantApiService.getRecentMatches('TestPlayer', 'NA1', 'ap', true)

      const matchIds = results.map((r) => r.matchId)
      assert.lengthOf(matchIds, 2)
      assert.include(matchIds, 'shared-1')
      assert.include(matchIds, 'custom-only')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
