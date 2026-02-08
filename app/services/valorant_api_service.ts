import env from '#start/env'
import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import logger from '@adonisjs/core/services/logger'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AGENT_LOOKUP } from '#constants/agents'

const henrikPlayerSchema = vine
  .object({
    puuid: vine.string(),
    name: vine.string(),
    tag: vine.string(),
    team: vine.string(),
  })
  .allowUnknownProperties()

const henrikTeamSchema = vine
  .object({
    rounds_won: vine.number().nullable(),
    rounds_lost: vine.number().nullable(),
  })
  .allowUnknownProperties()

const henrikMatchSchema = vine
  .object({
    metadata: vine
      .object({
        matchid: vine.string(),
        map: vine.string(),
        game_start_patched: vine.string(),
        mode: vine.string(),
        mode_id: vine.string().optional(),
        queue: vine.string().nullable().optional(),
        premier_info: vine
          .object({
            tournament_id: vine.string().nullable(),
            matchup_id: vine.string().nullable(),
          })
          .allowUnknownProperties()
          .optional(),
        region: vine.string(),
      })
      .allowUnknownProperties(),
    teams: vine
      .object({
        red: henrikTeamSchema,
        blue: henrikTeamSchema,
      })
      .allowUnknownProperties(),
    players: vine
      .object({
        all_players: vine.array(henrikPlayerSchema),
      })
      .allowUnknownProperties(),
  })
  .allowUnknownProperties()

const henrikApiResponseSchema = vine.object({
  status: vine.number(),
  data: vine.array(henrikMatchSchema),
})

type HenrikMatch = Infer<typeof henrikMatchSchema>

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
    showAll: boolean = false
  ): Promise<ParsedMatch[]> {
    const apiKey = env.get('HENRIK_API_KEY')
    if (!apiKey) {
      throw new Error('HENRIK_API_KEY is not configured')
    }

    const encodedName = encodeURIComponent(name)
    const encodedTag = encodeURIComponent(tag)
    const url = `https://api.henrikdev.xyz/valorant/v3/matches/${region}/${encodedName}/${encodedTag}`

    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Henrik API error: ${response.status} - ${text}`)
    }

    const rawText = await response.text()

    const logsDir = path.join(process.cwd(), 'storage', 'logs')
    await mkdir(logsDir, { recursive: true })

    const logFile = path.join(logsDir, `valorant_matchlist_${Date.now()}.json`)
    await writeFile(logFile, rawText, 'utf8')
    logger.info({ url, logFile }, 'Valorant match lookup raw response saved')

    const json = JSON.parse(rawText)
    const data = await vine.validate({ schema: henrikApiResponseSchema, data: json })

    return data.data
      .map((match) => {
        const matchTypeInfo = this.getMatchType(match)
        if (!matchTypeInfo) {
          return null
        }
        if (!showAll && matchTypeInfo.matchType === 'Other') {
          return null
        }

        const playerTeam = this.findPlayerTeam(match, name, tag)
        if (!playerTeam) {
          return null
        }

        const scores = this.calculateScores(match, playerTeam)
        if (!scores) {
          return null
        }

        const { scoreUs, scoreThem } = scores
        const result = this.determineResult(scoreUs, scoreThem)

        return {
          matchId: match.metadata.matchid,
          map: match.metadata.map,
          mode: match.metadata.mode,
          date: match.metadata.game_start_patched,
          matchType: matchTypeInfo.matchType,
          matchTypeLabel: matchTypeInfo.label,
          scoreUs,
          scoreThem,
          result,
        }
      })
      .filter((match): match is ParsedMatch => match !== null)
  }

  private static getMatchType(
    match: HenrikMatch
  ): { matchType: 'Premier' | 'Custom' | 'Other'; label: string | null } | null {
    if (match.metadata.premier_info?.tournament_id || match.metadata.premier_info?.matchup_id) {
      return { matchType: 'Premier', label: 'Premier' }
    }

    const queue = (match.metadata.queue || '').toLowerCase()
    const mode = (match.metadata.mode || '').toLowerCase()
    const modeId = (match.metadata.mode_id || '').toLowerCase()

    if (queue.includes('premier') || mode.includes('premier') || modeId.includes('premier')) {
      return { matchType: 'Premier', label: 'Premier' }
    }
    if (queue.includes('custom') || mode.includes('custom') || modeId.includes('custom')) {
      return { matchType: 'Custom', label: 'Custom' }
    }

    return { matchType: 'Other', label: null }
  }

  private static findPlayerTeam(
    match: HenrikMatch,
    name: string,
    tag: string
  ): 'Red' | 'Blue' | null {
    const player = match.players.all_players.find(
      (p) =>
        p.name.toLowerCase() === name.toLowerCase() && p.tag.toLowerCase() === tag.toLowerCase()
    )
    if (!player) {
      return null
    }
    if (player.team !== 'Red' && player.team !== 'Blue') {
      return null
    }
    return player.team
  }

  private static calculateScores(
    match: HenrikMatch,
    playerTeam: 'Red' | 'Blue'
  ): { scoreUs: number; scoreThem: number } | null {
    const redWon = match.teams.red.rounds_won
    const blueWon = match.teams.blue.rounds_won
    if (typeof redWon !== 'number' || typeof blueWon !== 'number') {
      return null
    }

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
