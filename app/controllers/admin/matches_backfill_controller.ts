import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import Match from '#models/match'
import User from '#models/user'
import env from '#start/env'
import ValorantApiService, { RateLimitError } from '#services/valorant_api_service'
import MatchStatsSyncService from '#services/match_stats_sync_service'
import MatchSyncedPlayersOrderService from '#services/match_synced_players_order_service'
import { matchBackfillValidator } from '#validators/match_backfill_validator'

const DEFAULT_PREMIER_TEAM_NAME = 'OPERATORS'

const ALLOWED_DAYS_BACK = [14, 30, 60, 90]
const DEFAULT_DAYS_BACK = 30

export default class MatchesBackfillController {
  async step1({ view }: HttpContext) {
    const rosterPlayers = await User.query()
      .where('isOnRoster', true)
      .where('approvalStatus', 'approved')
      .whereNotNull('trackerggUsername')
      .orderBy('fullName', 'asc')

    const playersWithRiotId = rosterPlayers.filter((player) => {
      const parsed = ValorantApiService.parseRiotId(player.trackerggUsername || '')
      return parsed !== null
    })

    return view.render('partials/valorant_backfill/step1_select_player', {
      players: playersWithRiotId,
      daysBackOptions: ALLOWED_DAYS_BACK,
      defaultDaysBack: DEFAULT_DAYS_BACK,
    })
  }

  async step2({ request, view }: HttpContext) {
    const playerId = request.input('playerId')
    const showAll = request.input('showAll') === '1'
    const requestedDays = Number.parseInt(request.input('daysBack'), 10)
    const daysBack = ALLOWED_DAYS_BACK.includes(requestedDays) ? requestedDays : DEFAULT_DAYS_BACK

    const player = await User.findOrFail(playerId)

    const riotIdParts = ValorantApiService.parseRiotId(player.trackerggUsername || '')
    if (!riotIdParts) {
      return view.render('partials/valorant_backfill/error', {
        error: 'Invalid Riot ID format. Expected "Name#TAG".',
      })
    }

    // Roughly 5 matches per day for an active player. Cap at 8 pages (80 matches)
    // so the longest 90-day search costs at most 8 API calls per mode.
    const maxPages = Math.min(8, Math.max(3, Math.ceil(daysBack / 5)))

    const premierTeamName = env.get('PREMIER_TEAM_NAME') ?? DEFAULT_PREMIER_TEAM_NAME

    try {
      const apiMatches = await ValorantApiService.getRecentMatches(
        riotIdParts.name,
        riotIdParts.tag,
        undefined,
        showAll,
        daysBack,
        maxPages,
        player.puuid,
        premierTeamName
      )

      const existingValorantIds = await this.findExistingValorantMatchIds(
        apiMatches.map((m) => m.matchId)
      )

      return view.render('partials/valorant_backfill/step2_select_match', {
        player,
        recentMatches: apiMatches,
        daysBack,
        existingValorantIds,
      })
    } catch (error) {
      return view.render('partials/valorant_backfill/error', {
        error: this.formatApiError(error),
      })
    }
  }

  async lookupByUuid({ request, view }: HttpContext) {
    const rawId = String(request.input('matchUuid') || '').trim()
    if (!rawId) {
      return view.render('partials/valorant_backfill/error', {
        error: 'Please paste a Valorant match UUID.',
      })
    }
    if (!/^[0-9a-f-]{20,48}$/i.test(rawId)) {
      return view.render('partials/valorant_backfill/error', {
        error: 'That doesn\'t look like a valid match UUID.',
      })
    }

    const existing = await Match.query().where('valorantMatchId', rawId).first()
    if (existing) {
      return view.render('partials/valorant_backfill/error', {
        error: `This Valorant match is already linked to match #${existing.id}.`,
      })
    }

    const knownRiotIds = await MatchSyncedPlayersOrderService.getKnownRiotIds()
    const premierTeamName = env.get('PREMIER_TEAM_NAME') ?? DEFAULT_PREMIER_TEAM_NAME

    try {
      const parsed = await ValorantApiService.getMatchByUuid(rawId, knownRiotIds, premierTeamName)

      if (!parsed) {
        return view.render('partials/valorant_backfill/error', {
          error: `Found the match, but couldn't identify our team. We looked for a roster Riot ID in the players list and for a Premier team named "${premierTeamName}". Set PREMIER_TEAM_NAME in the env if your team name differs.`,
        })
      }

      return view.render('partials/valorant_backfill/step3_metadata', {
        valorantMatchId: parsed.matchId,
        scheduledAt: parsed.date,
        map: parsed.map,
        scoreUs: parsed.scoreUs,
        scoreThem: parsed.scoreThem,
        result: parsed.result,
      })
    } catch (error) {
      return view.render('partials/valorant_backfill/error', {
        error: this.formatApiError(error),
      })
    }
  }

  async step3({ request, view }: HttpContext) {
    const valorantMatchId = String(request.input('valorantMatchId') || '').trim()
    const scheduledAt = String(request.input('scheduledAt') || '').trim()
    const map = String(request.input('map') || '').trim()
    const scoreUs = Number.parseInt(request.input('scoreUs'), 10)
    const scoreThem = Number.parseInt(request.input('scoreThem'), 10)
    const result = String(request.input('result') || '').trim()

    if (!valorantMatchId || !scheduledAt) {
      return view.render('partials/valorant_backfill/error', {
        error: 'Missing match data. Please go back and reselect.',
      })
    }

    const existing = await Match.query().where('valorantMatchId', valorantMatchId).first()
    if (existing) {
      return view.render('partials/valorant_backfill/error', {
        error: `This Valorant match is already linked to match #${existing.id}.`,
      })
    }

    return view.render('partials/valorant_backfill/step3_metadata', {
      valorantMatchId,
      scheduledAt,
      map,
      scoreUs: Number.isFinite(scoreUs) ? scoreUs : 0,
      scoreThem: Number.isFinite(scoreThem) ? scoreThem : 0,
      result: ['win', 'loss', 'draw'].includes(result) ? result : 'win',
    })
  }

  async save({ request, response, view, session }: HttpContext) {
    let payload: {
      valorantMatchId: string
      scheduledAt: string
      map?: string
      scoreUs: number
      scoreThem: number
      result: 'win' | 'loss' | 'draw'
      matchType: 'scrim' | 'official' | 'prac' | 'playoffs'
      opponentName?: string
      notes?: string
    }

    try {
      payload = await request.validateUsing(matchBackfillValidator)
    } catch (error) {
      let message = 'Invalid backfill data.'
      if (error && typeof error === 'object' && 'messages' in error) {
        const messages = (error as { messages?: Array<{ message?: string }> }).messages
        if (messages && messages.length > 0 && messages[0].message) {
          message = messages[0].message
        }
      }
      response.status(422)
      return view.render('partials/valorant_backfill/error', { error: message })
    }

    const existing = await Match.query().where('valorantMatchId', payload.valorantMatchId).first()
    if (existing) {
      response.status(409)
      return view.render('partials/valorant_backfill/error', {
        error: `This Valorant match is already linked to match #${existing.id}.`,
      })
    }

    const scheduledAt = DateTime.fromISO(payload.scheduledAt, { zone: 'utc' })
    if (!scheduledAt.isValid) {
      response.status(422)
      return view.render('partials/valorant_backfill/error', {
        error: 'Invalid match date received from API.',
      })
    }

    const match = await Match.create({
      scheduledAt,
      map: payload.map || null,
      matchType: payload.matchType,
      opponentName: payload.opponentName || null,
      notes: payload.notes || null,
      scoreUs: payload.scoreUs,
      scoreThem: payload.scoreThem,
      result: payload.result,
      valorantMatchId: payload.valorantMatchId,
    })

    try {
      await MatchStatsSyncService.syncFromValorantMatchId(match, payload.valorantMatchId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.warn(
        { matchId: match.id, valorantMatchId: payload.valorantMatchId, error: errorMessage },
        'Failed to sync player stats during match backfill'
      )
    }

    session.flash('success', `Match backfilled (#${match.id}).`)
    response.header('HX-Redirect', `/matches/${match.id}`)
    return response.send('')
  }

  private formatApiError(error: unknown): string {
    if (error instanceof RateLimitError) {
      const seconds = error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : null
      return seconds
        ? `Henrik API rate limit exceeded. Try again in about ${seconds}s.`
        : 'Henrik API rate limit exceeded. Try again in a moment.'
    }
    if (error instanceof Error) return error.message
    return 'Failed to fetch matches from Valorant API'
  }

  private async findExistingValorantMatchIds(valorantIds: string[]): Promise<Set<string>> {
    if (valorantIds.length === 0) return new Set()
    const rows = await Match.query()
      .whereIn('valorantMatchId', valorantIds)
      .select('valorantMatchId')
    return new Set(
      rows.map((r) => r.valorantMatchId).filter((v): v is string => typeof v === 'string')
    )
  }
}
