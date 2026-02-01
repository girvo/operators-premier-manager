import type { HttpContext } from '@adonisjs/core/http'
import MatchAvailability from '#models/match_availability'
import Match from '#models/match'
import User from '#models/user'
import { spinner } from '#utils/html_components'

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

    // Fetch updated match data for the partial
    const match = await Match.query()
      .where('id', matchId)
      .preload('availabilities', (query) => {
        query.preload('user')
      })
      .firstOrFail()

    const players = await User.query().orderBy('fullName', 'asc')

    // Render the team availability partial
    const teamAvailabilityHtml = await view.render('partials/team_match_availability', {
      match,
      players,
    })

    // Return updated buttons for HTMx plus the OOB team availability
    const spinnerHtml = spinner('sm')
    const buttonsHtml = `
      <button
        hx-put="/matches/${matchId}/availability"
        hx-vals='{"status": "yes"}'
        hx-target="#my-availability"
        hx-swap="innerHTML"
        class="w-full py-3 rounded font-medium transition inline-flex items-center justify-center gap-2 ${status === 'yes' ? 'bg-green-600 text-white' : 'bg-valorant-dark hover:bg-green-900/30 text-green-400 border border-green-600/30'}"
      >
        <span class="htmx-indicator">${spinnerHtml}</span>
        <span>Yes, I can play</span>
      </button>
      <button
        hx-put="/matches/${matchId}/availability"
        hx-vals='{"status": "maybe"}'
        hx-target="#my-availability"
        hx-swap="innerHTML"
        class="w-full py-3 rounded font-medium transition inline-flex items-center justify-center gap-2 ${status === 'maybe' ? 'bg-yellow-600 text-white' : 'bg-valorant-dark hover:bg-yellow-900/30 text-yellow-400 border border-yellow-600/30'}"
      >
        <span class="htmx-indicator">${spinnerHtml}</span>
        <span>Maybe</span>
      </button>
      <button
        hx-put="/matches/${matchId}/availability"
        hx-vals='{"status": "no"}'
        hx-target="#my-availability"
        hx-swap="innerHTML"
        class="w-full py-3 rounded font-medium transition inline-flex items-center justify-center gap-2 ${status === 'no' ? 'bg-red-600 text-white' : 'bg-valorant-dark hover:bg-red-900/30 text-red-400 border border-red-600/30'}"
      >
        <span class="htmx-indicator">${spinnerHtml}</span>
        <span>No, I can't make it</span>
      </button>
    `

    return response.send(buttonsHtml + teamAvailabilityHtml)
  }
}
