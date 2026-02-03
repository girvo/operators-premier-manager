import type { HttpContext } from '@adonisjs/core/http'
import MatchAvailability from '#models/match_availability'
import Match from '#models/match'
import User from '#models/user'

export default class MatchAvailabilityController {
  async update({ params, request, response, auth, view }: HttpContext) {
    const user = auth.user!
    const matchId = params.id
    const { status } = request.only(['status'])

    await MatchAvailability.updateOrCreate(
      {
        matchId: Number.parseInt(matchId),
        userId: user.id,
      },
      {
        status,
      }
    )

    const match = await Match.query()
      .where('id', matchId)
      .preload('availabilities', (query) => {
        query.preload('user')
      })
      .firstOrFail()

    const players = await User.query().orderBy('fullName', 'asc')

    const userAvailability = match.availabilities.find((a) => a.userId === user.id)

    const buttonsHtml = await view.render('partials/match_availability_buttons', {
      match,
      userAvailability,
    })

    const teamAvailabilityHtml = await view.render('partials/team_match_availability', {
      match,
      players,
      isOobSwap: true,
    })

    return response.send(buttonsHtml + teamAvailabilityHtml)
  }
}
