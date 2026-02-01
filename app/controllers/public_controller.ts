import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Match from '#models/match'

export default class PublicController {
  async home({ view, auth, response }: HttpContext) {
    if (await auth.check()) {
      return response.redirect('/dashboard')
    }
    return view.render('pages/public/home')
  }

  async roster({ view }: HttpContext) {
    const players = await User.query().where('isOnRoster', true).orderBy('fullName', 'asc')
    return view.render('pages/public/roster', { players })
  }

  async results({ view }: HttpContext) {
    const matches = await Match.query()
      .whereNotNull('result')
      .orderBy('scheduledAt', 'desc')
      .limit(20)

    return view.render('pages/public/results', { matches })
  }
}
