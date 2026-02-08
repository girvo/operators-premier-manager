import type { HttpContext } from '@adonisjs/core/http'
import MatchAvailability from '#models/match_availability'
import Match from '#models/match'
import User from '#models/user'
import { AGENT_LOOKUP } from '#constants/agents'
import { DateTime } from 'luxon'

export default class MatchAvailabilityController {
  async update({ params, request, response, auth, view }: HttpContext) {
    const user = auth.user!
    const matchId = params.id
    const { status, compact } = request.only(['status', 'compact'])

    let match = await Match.query()
      .where('id', matchId)
      .preload('availabilities', (query) => {
        query.preload('user')
      })
      .preload('playerAgents')
      .firstOrFail()

    const isPastMatch = match.scheduledAt <= DateTime.now()

    if (!isPastMatch) {
      await MatchAvailability.updateOrCreate(
        {
          matchId: Number.parseInt(matchId),
          userId: user.id,
        },
        {
          status,
        }
      )

      match = await Match.query()
        .where('id', matchId)
        .preload('availabilities', (query) => {
          query.preload('user')
        })
        .preload('playerAgents')
        .firstOrFail()
    }

    const players = await User.query().orderBy('fullName', 'asc')

    const userAvailability = match.availabilities.find((a) => a.userId === user.id)

    if (!request.header('HX-Request')) {
      return response.redirect(`/matches/${match.id}`)
    }

    const matchAgentByUserId: Record<number, string> = {}
    for (const entry of match.playerAgents || []) {
      if (!entry.agentKey) continue
      matchAgentByUserId[entry.userId] = entry.agentKey
    }

    const buttonsHtml = await view.render('partials/match_availability_buttons', {
      match,
      userAvailability,
      compact: compact === true || compact === 'true',
      isPastMatch,
    })

    const teamAvailabilityHtml = await view.render('partials/team_match_availability', {
      match,
      players,
      isOobSwap: true,
      agentLookup: AGENT_LOOKUP,
      matchAgentByUserId,
    })

    const dashboardAvailabilityHtml = await view.render('partials/dashboard_team_availability', {
      match,
      players,
      isOobSwap: true,
      agentLookup: AGENT_LOOKUP,
    })

    return response.send(buttonsHtml + teamAvailabilityHtml + dashboardAvailabilityHtml)
  }
}
