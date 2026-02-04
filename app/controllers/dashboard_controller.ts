import type { HttpContext } from '@adonisjs/core/http'
import Match from '#models/match'
import User from '#models/user'
import { AGENT_LOOKUP } from '#constants/agents'
import { DateTime } from 'luxon'

export default class DashboardController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!

    const nextMatch = await Match.query()
      .where('scheduledAt', '>', DateTime.now().toSQL())
      .whereNull('result')
      .preload('availabilities', (query) => {
        query.preload('user')
      })
      .orderBy('scheduledAt', 'asc')
      .first()

    const userAvailability = nextMatch?.availabilities.find((a) => a.userId === user.id)

    const players = nextMatch ? await User.query().orderBy('fullName', 'asc') : []

    return view.render('pages/dashboard/index', {
      nextMatch,
      userAvailability,
      players,
      timezone: user.timezone,
      agentLookup: AGENT_LOOKUP,
    })
  }
}
