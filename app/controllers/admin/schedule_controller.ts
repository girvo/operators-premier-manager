import type { HttpContext } from '@adonisjs/core/http'
import GameMap from '#models/map'
import Match from '#models/match'
import { bulkScheduleValidator } from '#validators/schedule_validator'
import { DateTime } from 'luxon'

export default class ScheduleController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const maps = await GameMap.query().where('isActive', true).orderBy('name', 'asc')

    const now = DateTime.now().setZone(user.timezone)
    const nextWednesday = this.#getNextWednesday(now)

    const weeks = Array.from({ length: 7 }, (_, i) => {
      const wed = nextWednesday.plus({ weeks: i })
      const thu = wed.plus({ days: 1 })
      return {
        index: i,
        label: `Week ${i + 1}`,
        wedDate: wed.toFormat('ccc d LLL'),
        thuDate: thu.toFormat('ccc d LLL'),
      }
    })

    return view.render('pages/admin/schedule/index', { maps, weeks })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const user = auth.user!
    const data = await request.validateUsing(bulkScheduleValidator)

    const now = DateTime.now().setZone(user.timezone)
    const nextWednesday = this.#getNextWednesday(now)

    let matchCount = 0

    for (let i = 0; i < data.maps.length; i++) {
      const mapName = data.maps[i]
      const wed = nextWednesday.plus({ weeks: i })
      const thu = wed.plus({ days: 1 })

      const schedules = [
        { date: wed, hour: 18, matchType: 'prac' as const },
        { date: wed, hour: 19, matchType: 'prac' as const },
        { date: thu, hour: 18, matchType: 'official' as const },
        { date: thu, hour: 19, matchType: 'official' as const },
      ]

      for (const schedule of schedules) {
        const scheduledAt = schedule.date
          .set({ hour: schedule.hour, minute: 0, second: 0, millisecond: 0 })
          .toUTC()

        await Match.create({
          scheduledAt,
          map: mapName,
          matchType: schedule.matchType,
          opponentName: null,
          notes: null,
        })

        matchCount++
      }
    }

    session.flash(
      'success',
      `${matchCount} matches scheduled across ${data.maps.length} week${data.maps.length > 1 ? 's' : ''}.`
    )
    return response.redirect('/matches')
  }

  #getNextWednesday(from: DateTime): DateTime {
    const currentDay = from.weekday // 1=Mon, 3=Wed
    const daysUntilWed = currentDay <= 3 ? 3 - currentDay : 7 - currentDay + 3
    if (daysUntilWed === 0) {
      // If today is Wednesday, use next Wednesday
      return from.plus({ days: 7 }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
    }
    return from.plus({ days: daysUntilWed }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
  }
}
