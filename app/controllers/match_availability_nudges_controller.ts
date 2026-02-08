import type { HttpContext } from '@adonisjs/core/http'
import Match from '#models/match'
import MatchAvailabilityNudgeService from '#services/match_availability_nudge_service'

const toBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 'on' || value === 1 || value === '1'

export default class MatchAvailabilityNudgesController {
  async store({ params, auth, request, response, session }: HttpContext) {
    const adminUser = auth.user!
    const match = await Match.findOrFail(params.id)

    const nudgeService = new MatchAvailabilityNudgeService()
    const result = await nudgeService.sendNonResponderNudges(adminUser, match, {
      force: toBoolean(request.input('force')),
    })

    if (result.status === 'failed' || result.status === 'blocked') {
      session.flash('error', result.message)
    } else {
      session.flash('success', result.message)
    }

    return response.redirect(`/matches/${match.id}`)
  }
}
