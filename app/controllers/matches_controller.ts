import type { HttpContext } from '@adonisjs/core/http'
import Match from '#models/match'
import GameMap from '#models/map'
import User from '#models/user'
import WeeklyAvailability from '#models/weekly_availability'
import { createMatchValidator, updateMatchValidator } from '#validators/match_validator'
import { valorantScoreValidator } from '#validators/valorant_validator'
import { DateTime } from 'luxon'
import ValorantApiService from '#services/valorant_api_service'
import MatchStatsSyncService from '#services/match_stats_sync_service'
import MatchSyncedPlayersOrderService from '#services/match_synced_players_order_service'
import { AGENT_LOOKUP } from '#constants/agents'
import logger from '@adonisjs/core/services/logger'
import MatchNotification from '#models/match_notification'
import DiscordNotificationService from '#services/discord_notification_service'

export default class MatchesController {
  async index({ view, auth, request }: HttpContext) {
    const user = auth.user!
    const page = request.input('page', 1)

    const upcomingMatches = await Match.query()
      .preload('availabilities', (query) => {
        query.preload('user')
      })
      .where((query) => {
        query.where('scheduledAt', '>', DateTime.now().toSQL()!).whereNull('result')
      })
      .orderBy('scheduledAt', 'asc')

    const pastMatches = await Match.query()
      .preload('availabilities', (query) => {
        query.preload('user')
      })
      .where((query) => {
        query.where('scheduledAt', '<=', DateTime.now().toSQL()!).orWhereNotNull('result')
      })
      .orderBy('scheduledAt', 'desc')
      .paginate(page, 10)

    return view.render('pages/matches/index', {
      upcomingMatches,
      pastMatches,
      timezone: user.timezone,
    })
  }

  async create({ view }: HttpContext) {
    const maps = await GameMap.query().where('isActive', true).orderBy('name', 'asc')
    return view.render('pages/matches/create', { maps })
  }

  async checkAvailability({ request, view, auth }: HttpContext) {
    const user = auth.user!
    const datetimeParam = request.input('datetime')

    if (!datetimeParam) {
      return view.render('partials/schedule_availability_check', { datetime: null })
    }

    const datetime = DateTime.fromFormat(datetimeParam, 'yyyy-MM-dd HH:mm', {
      zone: user.timezone,
    })

    if (!datetime.isValid) {
      return view.render('partials/schedule_availability_check', { datetime: null })
    }

    const utcDatetime = datetime.toUTC()
    const utcDayOfWeek = utcDatetime.weekday === 7 ? 0 : utcDatetime.weekday
    const utcHour = utcDatetime.hour

    const rosterPlayers = await User.query()
      .where('isOnRoster', true)
      .where('approvalStatus', 'approved')
      .orderBy('fullName', 'asc')

    const availabilities = await WeeklyAvailability.query()
      .where('dayOfWeek', utcDayOfWeek)
      .where('hour', utcHour)

    const availabilityByUserId: Record<number, boolean> = {}
    for (const avail of availabilities) {
      availabilityByUserId[avail.userId] = Boolean(avail.isAvailable)
    }

    const players = rosterPlayers.map((player) => {
      const isAvailable = !!availabilityByUserId[player.id]

      return {
        id: player.id,
        fullName: player.fullName,
        discordUsername: player.discordUsername,
        email: player.email,
        isAvailable,
      }
    })

    const availableCount = players.filter((p) => p.isAvailable).length
    const totalCount = players.length

    const formattedDatetime = datetime.toFormat("cccc, LLL d, yyyy 'at' h:mm a")

    return view.render('partials/schedule_availability_check', {
      datetime: datetimeParam,
      formattedDatetime,
      players,
      availableCount,
      totalCount,
    })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const user = auth.user!
    const data = await request.validateUsing(createMatchValidator)

    const scheduledAt = DateTime.fromFormat(data.scheduledAt, 'yyyy-MM-dd HH:mm', {
      zone: user.timezone,
    }).toUTC()

    await Match.create({
      scheduledAt,
      opponentName: data.opponentName || null,
      map: data.map || null,
      matchType: data.matchType,
      notes: data.notes || null,
    })

    session.flash('success', 'Match scheduled successfully')
    return response.redirect('/matches')
  }

  async show({ params, view, auth }: HttpContext) {
    const user = auth.user!
    const match = await Match.query()
      .where('id', params.id)
      .preload('availabilities', (query) => {
        query.preload('user')
      })
      .preload('playerAgents')
      .preload('syncedPlayers', (query) => {
        query.orderBy('kills', 'desc').orderBy('playerName', 'asc')
      })
      .firstOrFail()

    const players = await User.query().orderBy('fullName', 'asc')

    const userAvailability = match.availabilities.find((a) => a.userId === user.id)

    const matchAgentByUserId: Record<number, string> = {}
    for (const entry of match.playerAgents || []) {
      matchAgentByUserId[entry.userId] = entry.agentKey
    }

    const playedAgents = (match.playerAgents || [])
      .map((entry) => {
        const player = players.find((p) => p.id === entry.userId)
        if (!player) return null
        return {
          id: player.id,
          name: player.fullName ?? player.email,
          agentKey: entry.agentKey,
          kills: entry.kills,
          deaths: entry.deaths,
          assists: entry.assists,
        }
      })
      .filter(
        (
          entry
        ): entry is {
          id: number
          name: string
          agentKey: string
          kills: number | null
          deaths: number | null
          assists: number | null
        } => Boolean(entry)
      )

    const knownRiotIds = await MatchSyncedPlayersOrderService.getKnownRiotIds()
    const ourSyncedTeam = MatchSyncedPlayersOrderService.determineOurTeam(
      match.syncedPlayers || [],
      knownRiotIds
    )
    const sortedSyncedPlayers = MatchSyncedPlayersOrderService.sortPlayers(
      match.syncedPlayers || [],
      ourSyncedTeam
    )

    return view.render('pages/matches/show', {
      match,
      players,
      userAvailability,
      isPastMatch: match.scheduledAt <= DateTime.now(),
      timezone: user.timezone,
      agentLookup: AGENT_LOOKUP,
      matchAgentByUserId,
      playedAgents,
      ourSyncedTeam,
      sortedSyncedPlayers,
    })
  }

  async edit({ params, view }: HttpContext) {
    const match = await Match.findOrFail(params.id)
    const maps = await GameMap.query().where('isActive', true).orderBy('name', 'asc')
    return view.render('pages/matches/edit', { match, maps })
  }

  async update({ params, request, response, session, auth }: HttpContext) {
    const user = auth.user!
    const match = await Match.findOrFail(params.id)
    const data = await request.validateUsing(updateMatchValidator)

    const scheduledAt = DateTime.fromFormat(data.scheduledAt, 'yyyy-MM-dd HH:mm', {
      zone: user.timezone,
    }).toUTC()

    match.scheduledAt = scheduledAt
    match.opponentName = data.opponentName || null
    match.map = data.map || null
    match.matchType = data.matchType
    match.notes = data.notes || null

    await match.save()

    session.flash('success', 'Match updated successfully')
    return response.redirect('/matches')
  }

  async destroy({ params, request, response, session }: HttpContext) {
    const match = await Match.findOrFail(params.id)

    if (request.header('HX-Request')) {
      await match.delete()
      return response.status(200).send('')
    }

    await match.delete()
    session.flash('success', 'Match deleted successfully')
    return response.redirect('/matches')
  }

  async updateResult({ params, request, response, view }: HttpContext) {
    const match = await Match.findOrFail(params.id)
    const { result } = request.only(['result'])

    match.result = result || null
    await match.save()

    if (request.header('HX-Request')) {
      return response.send(await view.render('partials/match_result_badge', { result }))
    }

    return response.redirect('/matches')
  }

  async fetchFromValorantStep1({ params, view }: HttpContext) {
    const match = await Match.findOrFail(params.id)

    const rosterPlayers = await User.query()
      .where('isOnRoster', true)
      .where('approvalStatus', 'approved')
      .whereNotNull('trackerggUsername')
      .orderBy('fullName', 'asc')

    const playersWithRiotId = rosterPlayers.filter((player) => {
      const parsed = ValorantApiService.parseRiotId(player.trackerggUsername || '')
      return parsed !== null
    })

    return view.render('partials/valorant_fetch/step1_select_player', {
      match,
      players: playersWithRiotId,
    })
  }

  async fetchFromValorantStep2({ params, request, view }: HttpContext) {
    const match = await Match.findOrFail(params.id)
    const playerId = request.input('playerId')
    const showAll = request.input('showAll') === '1'

    const player = await User.findOrFail(playerId)

    const riotIdParts = ValorantApiService.parseRiotId(player.trackerggUsername || '')
    if (!riotIdParts) {
      return view.render('partials/valorant_fetch/error', {
        match,
        error: 'Invalid Riot ID format. Expected "Name#TAG".',
      })
    }

    try {
      const matches = await ValorantApiService.getRecentMatches(
        riotIdParts.name,
        riotIdParts.tag,
        undefined,
        showAll
      )

      return view.render('partials/valorant_fetch/step2_select_match', {
        match,
        player,
        recentMatches: matches,
      })
    } catch (error) {
      return view.render('partials/valorant_fetch/error', {
        match,
        error: error instanceof Error ? error.message : 'Failed to fetch matches from Valorant API',
      })
    }
  }

  async fetchFromValorantSave({ params, request, response, view }: HttpContext) {
    const match = await Match.findOrFail(params.id)

    let payload: {
      scoreUs: number
      scoreThem: number
      result: 'win' | 'loss' | 'draw'
      matchId: string
    }
    try {
      payload = await request.validateUsing(valorantScoreValidator)
    } catch (error) {
      let message = 'Invalid score data.'
      if (error && typeof error === 'object' && 'messages' in error) {
        const messages = (error as { messages?: Array<{ message?: string }> }).messages
        if (messages && messages.length > 0 && messages[0].message) {
          message = messages[0].message
        }
      }
      response.status(422)
      return view.render('partials/valorant_fetch/error', { match, error: message })
    }

    match.scoreUs = payload.scoreUs
    match.scoreThem = payload.scoreThem
    match.result = payload.result
    match.valorantMatchId = payload.matchId

    await match.save()

    try {
      await MatchStatsSyncService.syncFromValorantMatchId(match, payload.matchId)
    } catch (error) {
      logger.warn(
        { matchId: match.id, error },
        'Failed to sync match player stats from Valorant API'
      )
    }

    response.header('HX-Trigger', 'valorantScoreSaved')
    return response.send('')
  }

  async sendNotification({ params, response }: HttpContext) {
    const match = await Match.find(params.id)

    if (!match) {
      response.status(404)
      return response.send('Match not found')
    }

    if (match.scheduledAt <= DateTime.now()) {
      response.status(400)
      return response.send('Cannot notify for past match')
    }

    const existing = await MatchNotification.query()
      .where('matchId', match.id)
      .where('notificationType', 'manual')
      .first()

    if (existing) {
      return response.send('Already notified')
    }

    const discordService = new DiscordNotificationService()

    // Check for a paired match (official/prac matches come in pairs)
    const pairedMatch = await discordService.findPairedMatch(match)

    const success = await discordService.sendMatchReminder(
      match,
      'manual',
      pairedMatch ?? undefined
    )

    if (success) {
      // Mark both matches as notified
      await MatchNotification.create({
        matchId: match.id,
        notificationType: 'manual',
        sentAt: DateTime.now(),
      })

      if (pairedMatch) {
        await MatchNotification.create({
          matchId: pairedMatch.id,
          notificationType: 'manual',
          sentAt: DateTime.now(),
        })
      }

      return response.send(pairedMatch ? 'Both notified!' : 'Notified!')
    } else {
      response.status(500)
      return response.send('Failed to send')
    }
  }
}
