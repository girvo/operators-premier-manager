import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Match from '#models/match'
import MatchAvailability from '#models/match_availability'

const VALID_STATUSES = ['yes', 'maybe', 'no'] as const
type Status = (typeof VALID_STATUSES)[number]

const statusLabelByValue: Record<Status, string> = {
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
}

export default class MatchQuickRespondController {
  async handle({ params, auth, response, view }: HttpContext) {
    const status = params.status as string

    if (!VALID_STATUSES.includes(status as Status)) {
      response.status(400)
      return view.render('pages/matches/availability_response', {
        success: false,
        title: 'Invalid Link',
        message: 'This response link is invalid.',
      })
    }

    const match = await Match.find(params.id)
    if (!match) {
      response.status(404)
      return view.render('pages/matches/availability_response', {
        success: false,
        title: 'Match Not Found',
        message: 'This match could not be found.',
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

    const user = auth.user!

    await MatchAvailability.updateOrCreate(
      { matchId: match.id, userId: user.id },
      { status: status as Status }
    )

    const localMatchTime = match.scheduledAt.setZone(user.timezone)
    const timezone = localMatchTime.isValid ? user.timezone : 'UTC'
    const formattedMatchTime = (
      localMatchTime.isValid ? localMatchTime : match.scheduledAt.toUTC()
    ).toFormat("cccc, LLL d, yyyy 'at' h:mm a")

    return view.render('pages/matches/availability_response', {
      success: true,
      title: 'Availability Updated',
      message: `Your response has been recorded as "${statusLabelByValue[status as Status]}".`,
      opponentName: match.opponentName ?? 'TBD',
      mapName: match.valorantMap ?? match.map ?? 'TBD',
      formattedMatchTime,
      timezone,
    })
  }
}
