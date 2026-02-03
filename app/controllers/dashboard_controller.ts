import type { HttpContext } from '@adonisjs/core/http'
import Match from '#models/match'
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

    return view.render('pages/dashboard/index', {
      nextMatch,
      userAvailability,
      timezone: user.timezone,
    })
  }
}
