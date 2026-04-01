import env from '#start/env'
import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import logger from '@adonisjs/core/services/logger'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AGENT_LOOKUP } from '#constants/agents'

// v4 player schema
const henrikV4PlayerSchema = vine
  .object({
    puuid: vine.string(),
    name: vine.string(),
    tag: vine.string(),
    team_id: vine.string(),
    agent: vine
      .object({
        name: vine.string(),
      })
      .allowUnknownProperties()
      .optional(),
  })
  .allowUnknownProperties()

// v4 team schema
const henrikV4TeamSchema = vine
  .object({
    team_id: vine.string(),
    rounds: vine
      .object({
        won: vine.number(),
        lost: vine.number(),
      })
      .allowUnknownProperties(),
    won: vine.boolean(),
    premier_roster: vine
      .object({
        id: vine.string().optional(),
      })
      .allowUnknownProperties()
      .optional(),
  })
  .allowUnknownProperties()

// v4 match schema
const henrikV4MatchSchema = vine
  .object({
    metadata: vine
      .object({
        match_id: vine.string(),
        map: vine
          .object({
            name: vine.string(),
          })
          .allowUnknownProperties(),
        started_at: vine.string(),
        queue: vine
          .object({
            id: vine.string(),
            name: vine.string(),
          })
          .allowUnknownProperties(),
        premier: vine
          .object({
            id: vine.string().optional(),
          })
          .allowUnknownProperties()
          .optional()
          .nullable(),
        region: vine.string(),
      })
      .allowUnknownProperties(),
    teams: vine.array(henrikV4TeamSchema),
    players: vine.array(henrikV4PlayerSchema),
  })
  .allowUnknownProperties()

const henrikV4ApiResponseSchema = vine.object({
  status: vine.number(),
  data: vine.array(henrikV4MatchSchema),
})

type HenrikV4Match = Infer<typeof henrikV4MatchSchema>

export interface ParsedMatch {
  matchId: string
  map: string
  mode: string
  date: string
  matchType: 'Premier' | 'Custom' | 'Other'
  matchTypeLabel: string | null
  scoreUs: number
  scoreThem: number
  result: 'win' | 'loss' | 'draw'
}

export interface MatchPlayerStatEntry {
  riotId: string
  playerName: string
  playerTag: string
  team: 'Red' | 'Blue' | null
  agentKey: string | null
  kills: number | null
  deaths: number | null
  assists: number | null
  score: number | null
  headshots: number | null
  bodyshots: number | null
  legshots: number | null
}

export interface MatchStatsSnapshot {
  map: string | null
  players: MatchPlayerStatEntry[]
}

export default class ValorantApiService {
  static parseRiotId(riotId: string): { name: string; tag: string } | null {
    const parts = riotId.split('#')
    if (parts.length !== 2) {
      return null
    }
    return {
      name: parts[0].trim(),
      tag: parts[1].trim(),
    }
  }

  static async getMatchPlayerStats(matchId: string): Promise<MatchPlayerStatEntry[]> {
    const snapshot = await this.getMatchStatsSnapshot(matchId)
    return snapshot.players
  }

  static async getMatchStatsSnapshot(matchId: string): Promise<MatchStatsSnapshot> {
    const apiKey = env.get('HENRIK_API_KEY')
    if (!apiKey) {
      throw new Error('HENRIK_API_KEY is not configured')
    }

    const url = `https://api.henrikdev.xyz/valorant/v2/match/${encodeURIComponent(matchId)}`
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Henrik API error: ${response.status} - ${text}`)
    }

    const json = (await response.json()) as {
      data?: {
        metadata?: {
          map?: unknown
        }
        players?: { all_players?: Array<Record<string, unknown>> }
      }
    }

    const map =
      typeof json?.data?.metadata?.map === 'string' && json.data.metadata.map.trim()
        ? json.data.metadata.map.trim()
        : null

    const players = json?.data?.players?.all_players ?? []
    const parsedPlayers = players
      .map((player) => {
        const name = typeof player.name === 'string' ? player.name.trim() : null
        const tag = typeof player.tag === 'string' ? player.tag.trim() : null
        if (!name || !tag) return null

        const rawAgent =
          (typeof player.character === 'string' && player.character) ||
          (typeof player.character_name === 'string' && player.character_name) ||
          (typeof player.agent === 'string' && player.agent) ||
          (typeof player.agent_name === 'string' && player.agent_name) ||
          (typeof player.character_id === 'string' && player.character_id) ||
          null

        const normalizedAgent = rawAgent ? this.normalizeAgentKey(rawAgent) : null
        const agentKey = normalizedAgent && AGENT_LOOKUP[normalizedAgent] ? normalizedAgent : null
        const team = player.team === 'Red' || player.team === 'Blue' ? player.team : null

        const stats =
          typeof player.stats === 'object' && player.stats
            ? (player.stats as Record<string, unknown>)
            : null

        const kills = this.readNumber(player.kills) ?? this.readNumber(stats?.kills)
        const deaths = this.readNumber(player.deaths) ?? this.readNumber(stats?.deaths)
        const assists = this.readNumber(player.assists) ?? this.readNumber(stats?.assists)
        const score = this.readNumber(player.score) ?? this.readNumber(stats?.score)
        const headshots = this.readNumber(player.headshots) ?? this.readNumber(stats?.headshots)
        const bodyshots = this.readNumber(player.bodyshots) ?? this.readNumber(stats?.bodyshots)
        const legshots = this.readNumber(player.legshots) ?? this.readNumber(stats?.legshots)

        return {
          riotId: `${name}#${tag}`.toLowerCase(),
          playerName: name,
          playerTag: tag,
          team,
          agentKey,
          kills,
          deaths,
          assists,
          score,
          headshots,
          bodyshots,
          legshots,
        }
      })
      .filter((entry): entry is MatchPlayerStatEntry => entry !== null)

    return {
      map,
      players: parsedPlayers,
    }
  }

  static async getRecentMatches(
    name: string,
    tag: string,
    region: string = 'ap',
    showAll: boolean = false,
    daysBack: number = 14
  ): Promise<ParsedMatch[]> {
    const apiKey = env.get('HENRIK_API_KEY')
    if (!apiKey) {
      throw new Error('HENRIK_API_KEY is not configured')
    }

    const encodedName = encodeURIComponent(name)
    const encodedTag = encodeURIComponent(tag)
    const baseUrl = `https://api.henrikdev.xyz/valorant/v4/matches/${region}/pc/${encodedName}/${encodedTag}`

    // v4 API has max size=10 per request, need pagination for more matches
    const fetchMatchesPage = async (start: number, mode?: string) => {
      const params = new URLSearchParams()
      params.set('size', '10')
      params.set('start', String(start))
      if (mode) params.set('mode', mode)

      const url = `${baseUrl}?${params.toString()}`
      const response = await fetch(url, {
        headers: {
          Authorization: apiKey,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Henrik API error: ${response.status} - ${text}`)
      }

      return response.text()
    }

    // Fetch multiple pages to get enough matches for the date range
    // Start with 3 pages (30 matches) which should cover 14 days for most players
    const pagesToFetch = 3
    const fetchPromises: Promise<string>[] = []

    // Fetch default pages (all modes)
    for (let i = 0; i < pagesToFetch; i++) {
      fetchPromises.push(fetchMatchesPage(i * 10))
    }

    // Also fetch custom games if showAll is true
    if (showAll) {
      for (let i = 0; i < pagesToFetch; i++) {
        fetchPromises.push(fetchMatchesPage(i * 10, 'custom'))
      }
    }

    const rawResponses = await Promise.all(fetchPromises)

    // Log responses for debugging (skip in test environment)
    if (process.env.NODE_ENV !== 'test') {
      const logsDir = path.join(process.cwd(), 'storage', 'logs')
      await mkdir(logsDir, { recursive: true })
      const timestamp = Date.now()
      const logFile = path.join(logsDir, `valorant_matchlist_${timestamp}.json`)
      await writeFile(logFile, JSON.stringify(rawResponses), 'utf8')
      logger.info(
        { baseUrl, logFile, pagesFetched: rawResponses.length },
        'Valorant match lookup raw responses saved'
      )
    }

    // Parse and validate responses
    const allMatches: HenrikV4Match[] = []
    const seenMatchIds = new Set<string>()

    for (const rawText of rawResponses) {
      const json = JSON.parse(rawText)
      const validated = await vine.validate({ schema: henrikV4ApiResponseSchema, data: json })
      for (const match of validated.data) {
        if (!seenMatchIds.has(match.metadata.match_id)) {
          seenMatchIds.add(match.metadata.match_id)
          allMatches.push(match)
        }
      }
    }

    // Filter by date range
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    const matchesWithinRange = allMatches.filter((match) => {
      const matchDate = new Date(match.metadata.started_at)
      return matchDate >= cutoffDate
    })

    return matchesWithinRange
      .map((match) => {
        const matchTypeInfo = this.getMatchTypeV4(match)
        if (!matchTypeInfo) {
          return null
        }
        if (!showAll && matchTypeInfo.matchType === 'Other') {
          return null
        }

        const playerTeam = this.findPlayerTeamV4(match, name, tag)
        if (!playerTeam) {
          return null
        }

        const scores = this.calculateScoresV4(match, playerTeam)
        if (!scores) {
          return null
        }

        const { scoreUs, scoreThem } = scores
        const result = this.determineResult(scoreUs, scoreThem)

        return {
          matchId: match.metadata.match_id,
          map: match.metadata.map.name,
          mode: match.metadata.queue.name,
          date: match.metadata.started_at,
          matchType: matchTypeInfo.matchType,
          matchTypeLabel: matchTypeInfo.label,
          scoreUs,
          scoreThem,
          result,
        }
      })
      .filter((match): match is ParsedMatch => match !== null)
  }

  private static getMatchTypeV4(
    match: HenrikV4Match
  ): { matchType: 'Premier' | 'Custom' | 'Other'; label: string | null } | null {
    // Check premier roster info on teams
    if (match.teams.some((t) => t.premier_roster?.id)) {
      return { matchType: 'Premier', label: 'Premier' }
    }

    // Check queue id
    const queueId = match.metadata.queue.id.toLowerCase()
    if (queueId === 'premier') {
      return { matchType: 'Premier', label: 'Premier' }
    }
    if (queueId === 'custom') {
      return { matchType: 'Custom', label: 'Custom' }
    }

    return { matchType: 'Other', label: null }
  }

  private static findPlayerTeamV4(
    match: HenrikV4Match,
    name: string,
    tag: string
  ): 'Red' | 'Blue' | null {
    const player = match.players.find(
      (p) =>
        p.name.toLowerCase() === name.toLowerCase() && p.tag.toLowerCase() === tag.toLowerCase()
    )
    if (!player) {
      return null
    }
    if (player.team_id !== 'Red' && player.team_id !== 'Blue') {
      return null
    }
    return player.team_id
  }

  private static calculateScoresV4(
    match: HenrikV4Match,
    playerTeam: 'Red' | 'Blue'
  ): { scoreUs: number; scoreThem: number } | null {
    const redTeam = match.teams.find((t) => t.team_id === 'Red')
    const blueTeam = match.teams.find((t) => t.team_id === 'Blue')

    if (!redTeam || !blueTeam) {
      return null
    }

    const redWon = redTeam.rounds.won
    const blueWon = blueTeam.rounds.won

    if (playerTeam === 'Red') {
      return {
        scoreUs: redWon,
        scoreThem: blueWon,
      }
    }
    return {
      scoreUs: blueWon,
      scoreThem: redWon,
    }
  }

  private static determineResult(scoreUs: number, scoreThem: number): 'win' | 'loss' | 'draw' {
    if (scoreUs > scoreThem) return 'win'
    if (scoreUs < scoreThem) return 'loss'
    return 'draw'
  }

  private static readNumber(value: unknown): number | null {
    return typeof value === 'number' ? value : null
  }

  private static normalizeAgentKey(rawAgent: string): string | null {
    const cleaned = rawAgent.trim().toLowerCase()
    if (!cleaned) return null
    if (cleaned === 'kay/o' || cleaned === 'kayo') return 'kay-o'
    return cleaned
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  }
}
