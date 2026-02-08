import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Match from '#models/match'
import { AGENT_LOOKUP } from '#constants/agents'
import MatchSyncedPlayer from '#models/match_synced_player'
import MatchSyncedPlayersOrderService from '#services/match_synced_players_order_service'

export default class PublicController {
  async home({ view, auth, response }: HttpContext) {
    if (await auth.check()) {
      return response.redirect('/dashboard')
    }
    return view.render('pages/public/home')
  }

  async roster({ view }: HttpContext) {
    const players = await User.query().where('isOnRoster', true).orderBy('fullName', 'asc')
    return view.render('pages/public/roster', { players, agentLookup: AGENT_LOOKUP })
  }

  async results({ view, request }: HttpContext) {
    const page = request.input('page', 1)

    const matches = await Match.query()
      .whereNotNull('result')
      .preload('syncedPlayers', (query) => {
        query.orderBy('kills', 'desc').orderBy('playerName', 'asc')
      })
      .orderBy('scheduledAt', 'desc')
      .paginate(page, 20)

    const knownRiotIds = await MatchSyncedPlayersOrderService.getKnownRiotIds()
    const ourTeamByMatchId: Record<number, 'Red' | 'Blue' | null> = {}
    const sortedSyncedPlayersByMatchId: Record<number, MatchSyncedPlayer[]> = {}

    for (const match of matches.all()) {
      const syncedPlayers = match.syncedPlayers || []
      const ourTeam = MatchSyncedPlayersOrderService.determineOurTeam(syncedPlayers, knownRiotIds)
      ourTeamByMatchId[match.id] = ourTeam
      sortedSyncedPlayersByMatchId[match.id] = MatchSyncedPlayersOrderService.sortPlayers(
        syncedPlayers,
        ourTeam
      )
    }

    return view.render('pages/public/results', {
      matches,
      agentLookup: AGENT_LOOKUP,
      ourTeamByMatchId,
      sortedSyncedPlayersByMatchId,
    })
  }
}
