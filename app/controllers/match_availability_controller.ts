import type { HttpContext } from '@adonisjs/core/http'
import MatchAvailability from '#models/match_availability'

export default class MatchAvailabilityController {
  async update({ params, request, response, auth }: HttpContext) {
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

    // Return updated buttons for HTMx
    return response.send(`
      <button
        hx-put="/matches/${matchId}/availability"
        hx-vals='{"status": "yes"}'
        hx-target="#my-availability"
        hx-swap="innerHTML"
        class="w-full py-3 rounded font-medium transition ${status === 'yes' ? 'bg-green-600 text-white' : 'bg-valorant-dark hover:bg-green-900/30 text-green-400 border border-green-600/30'}"
      >
        Yes, I can play
      </button>
      <button
        hx-put="/matches/${matchId}/availability"
        hx-vals='{"status": "maybe"}'
        hx-target="#my-availability"
        hx-swap="innerHTML"
        class="w-full py-3 rounded font-medium transition ${status === 'maybe' ? 'bg-yellow-600 text-white' : 'bg-valorant-dark hover:bg-yellow-900/30 text-yellow-400 border border-yellow-600/30'}"
      >
        Maybe
      </button>
      <button
        hx-put="/matches/${matchId}/availability"
        hx-vals='{"status": "no"}'
        hx-target="#my-availability"
        hx-swap="innerHTML"
        class="w-full py-3 rounded font-medium transition ${status === 'no' ? 'bg-red-600 text-white' : 'bg-valorant-dark hover:bg-red-900/30 text-red-400 border border-red-600/30'}"
      >
        No, I can't make it
      </button>
    `)
  }
}
