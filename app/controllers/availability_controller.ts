import type { HttpContext } from '@adonisjs/core/http'
import WeeklyAvailability from '#models/weekly_availability'
import TimezoneService from '#services/timezone_service'

export default class AvailabilityController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const timezone = user.timezone

    // Get all existing availabilities for this user
    const availabilities = await WeeklyAvailability.query().where('userId', user.id)

    // Create a set of available UTC slots for quick lookup
    const availableSlots = new Set(
      availabilities.filter((a) => a.isAvailable).map((a) => `${a.dayOfWeek}-${a.hour}`)
    )

    // Build the grid data in user's local timezone
    const days = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun
    const hours = Array.from({ length: 12 }, (_, i) => i + 12)

    const grid = days.map((localDay) => {
      const hoursMapping = TimezoneService.getLocalHoursMapping(localDay, timezone)

      return {
        dayOfWeek: localDay,
        dayName: TimezoneService.getDayName(localDay),
        hours: hoursMapping.map((mapping) => ({
          localHour: mapping.localHour,
          utcDayOfWeek: mapping.utcDayOfWeek,
          utcHour: mapping.utcHour,
          isAvailable: availableSlots.has(`${mapping.utcDayOfWeek}-${mapping.utcHour}`),
          displayHour: TimezoneService.formatHour(mapping.localHour),
        })),
      }
    })

    return view.render('pages/availability/index', {
      grid,
      timezone,
      hours,
    })
  }

  async update({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { dayOfWeek, hour, isAvailable } = request.only(['dayOfWeek', 'hour', 'isAvailable'])

    const utcDayOfWeek = Number.parseInt(dayOfWeek)
    const utcHour = Number.parseInt(hour)
    const available = isAvailable === 'true' || isAvailable === true

    await WeeklyAvailability.updateOrCreate(
      {
        userId: user.id,
        dayOfWeek: utcDayOfWeek,
        hour: utcHour,
      },
      {
        isAvailable: available,
      }
    )

    // Return the updated slot HTML for HTMx
    const localTime = TimezoneService.toLocal(utcDayOfWeek, utcHour, user.timezone)

    return response.send(`
      <button
        class="w-full h-8 rounded text-xs transition ${available ? 'bg-green-600 hover:bg-green-700' : 'bg-valorant-dark hover:bg-valorant-gray border border-valorant-light/10'}"
        hx-put="/availability"
        hx-vals='{"dayOfWeek": "${utcDayOfWeek}", "hour": "${utcHour}", "isAvailable": "${!available}"}'
        hx-swap="outerHTML"
        title="${TimezoneService.getDayName(localTime.dayOfWeek)} ${TimezoneService.formatHour(localTime.hour)}"
      >
        ${available ? '✓' : ''}
      </button>
    `)
  }
}
