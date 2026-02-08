import type { HttpContext } from '@adonisjs/core/http'
import WeeklyAvailability from '#models/weekly_availability'
import User from '#models/user'
import TimezoneService from '#services/timezone_service'

export default class AvailabilityController {
  async index({ view, auth }: HttpContext) {
    const user = auth.user!
    const timezone = user.timezone

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

  async update({ request, auth, response, view }: HttpContext) {
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

    const localTime = TimezoneService.toLocal(utcDayOfWeek, utcHour, user.timezone)

    return response.send(
      await view.render('partials/availability_toggle_button', {
        isAvailable: available,
        utcDayOfWeek,
        utcHour,
        title: `${TimezoneService.getDayName(localTime.dayOfWeek)} ${TimezoneService.formatHour(localTime.hour)}`,
      })
    )
  }

  async compare({ view, auth }: HttpContext) {
    const user = auth.user!
    const timezone = user.timezone

    const rosterPlayers = await User.query()
      .where('isOnRoster', true)
      .where('approvalStatus', 'approved')
      .orderBy('fullName', 'asc')

    const slotDefinitions = [
      { id: 'wed-18', pairId: 'wed-thu', dayOfWeek: 3, hour: 18 },
      { id: 'wed-19', pairId: 'wed-thu', dayOfWeek: 3, hour: 19 },
      { id: 'thu-18', pairId: 'wed-thu', dayOfWeek: 4, hour: 18 },
      { id: 'thu-19', pairId: 'wed-thu', dayOfWeek: 4, hour: 19 },
      { id: 'fri-19', pairId: 'fri-sat', dayOfWeek: 5, hour: 19 },
      { id: 'fri-20', pairId: 'fri-sat', dayOfWeek: 5, hour: 20 },
      { id: 'sat-19', pairId: 'fri-sat', dayOfWeek: 6, hour: 19 },
      { id: 'sat-20', pairId: 'fri-sat', dayOfWeek: 6, hour: 20 },
    ]

    const slots = slotDefinitions.map((slot) => {
      const utc = TimezoneService.toUtc(slot.dayOfWeek, slot.hour, timezone)
      return {
        ...slot,
        utcDayOfWeek: utc.dayOfWeek,
        utcHour: utc.hour,
        displayTime: `${TimezoneService.getDayName(slot.dayOfWeek)} ${TimezoneService.formatHour(slot.hour)}`,
      }
    })

    const rosterIds = rosterPlayers.map((player) => player.id)
    const utcDays = Array.from(new Set(slots.map((slot) => slot.utcDayOfWeek)))
    const utcHours = Array.from(new Set(slots.map((slot) => slot.utcHour)))

    const availabilities = rosterIds.length
      ? await WeeklyAvailability.query()
          .whereIn('userId', rosterIds)
          .whereIn('dayOfWeek', utcDays)
          .whereIn('hour', utcHours)
      : []

    const availableSlotSet = new Set(
      availabilities.filter((a) => a.isAvailable).map((a) => `${a.userId}-${a.dayOfWeek}-${a.hour}`)
    )

    const players = rosterPlayers.map((player) => {
      const bySlot: Record<string, boolean> = {}
      for (const slot of slots) {
        bySlot[slot.id] = availableSlotSet.has(`${player.id}-${slot.utcDayOfWeek}-${slot.utcHour}`)
      }

      return {
        id: player.id,
        name: player.fullName ?? player.discordUsername ?? player.email,
        bySlot,
      }
    })

    const slotCounts = slots.reduce<Record<string, number>>((acc, slot) => {
      acc[slot.id] = players.filter((player) => player.bySlot[slot.id]).length
      return acc
    }, {})

    const pairs = [
      {
        id: 'wed-thu',
        title: 'Wednesday/Thursday Pair',
        subtitle: 'Wed 6pm, Wed 7pm, Thu 6pm, Thu 7pm',
      },
      {
        id: 'fri-sat',
        title: 'Friday/Saturday Pair',
        subtitle: 'Fri 7pm, Fri 8pm, Sat 7pm, Sat 8pm',
      },
    ].map((pair) => {
      const pairSlots = slots.filter((slot) => slot.pairId === pair.id)
      const minAvailable = pairSlots.reduce(
        (min, slot) => {
          const count = slotCounts[slot.id] ?? 0
          return min === null ? count : Math.min(min, count)
        },
        null as number | null
      )

      return {
        ...pair,
        slots: pairSlots,
        minAvailable: minAvailable ?? 0,
      }
    })

    return view.render('pages/availability/compare', {
      timezone,
      players,
      slotCounts,
      pairs,
      totalPlayers: rosterPlayers.length,
    })
  }
}
