import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Match from '#models/match'
import MatchAvailability from '#models/match_availability'
import User from '#models/user'
import MatchAvailabilityResponseTokenService from '#services/match_availability_response_token_service'

const statusLabelByValue: Record<'yes' | 'maybe' | 'no', string> = {
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
}

export default class MatchAvailabilityResponseController {
  async show({ params, response, view }: HttpContext) {
    const tokenService = new MatchAvailabilityResponseTokenService()
    const verification = await tokenService.verifyToken(params.token)

    if (!verification.ok) {
      response.status(verification.errorCode === 'token_expired' ? 410 : 400)
      return view.render('pages/matches/availability_response', {
        success: false,
        title: verification.errorCode === 'token_expired' ? 'Link Expired' : 'Invalid Link',
        message:
          verification.errorCode === 'token_expired'
            ? 'This response link has expired.'
            : 'This response link is invalid.',
      })
    }

    const { matchId, userId, status } = verification.payload
    const [match, user] = await Promise.all([Match.find(matchId), User.find(userId)])

    if (!match || !user) {
      response.status(404)
      return view.render('pages/matches/availability_response', {
        success: false,
        title: 'Invalid Link',
        message: 'This response link is no longer valid.',
      })
    }

    if (match.scheduledAt <= DateTime.now()) {
      response.status(410)
      return view.render('pages/matches/availability_response', {
        success: false,
        title: 'Match Already Passed',
        message: 'This match is in the past, so availability can no longer be updated.',
      })
    }

    await MatchAvailability.updateOrCreate(
      {
        matchId: match.id,
        userId: user.id,
      },
      {
        status,
      }
    )

    const localMatchTime = match.scheduledAt.setZone(user.timezone)
    const timezone = localMatchTime.isValid ? user.timezone : 'UTC'
    const formattedMatchTime = (
      localMatchTime.isValid ? localMatchTime : match.scheduledAt.toUTC()
    ).toFormat("cccc, LLL d, yyyy 'at' h:mm a")

    return view.render('pages/matches/availability_response', {
      success: true,
      title: 'Availability Updated',
      message: `Your response has been recorded as "${statusLabelByValue[status]}".`,
      opponentName: match.opponentName ?? 'TBD',
      mapName: match.valorantMap ?? match.map ?? 'TBD',
      formattedMatchTime,
      timezone,
    })
  }
}
