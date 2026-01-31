import { DateTime } from 'luxon'
import type { WeekdayNumbers } from 'luxon'

export default class TimezoneService {
  /**
   * Convert a local day/hour to UTC day/hour
   */
  static toUtc(
    dayOfWeek: number,
    hour: number,
    timezone: string
  ): { dayOfWeek: number; hour: number } {
    // Create a DateTime in the user's timezone for the given day/hour
    // Use a reference week (e.g., a Sunday that we know)
    // Luxon uses 1=Monday, 7=Sunday, but we use 0=Sunday, 1=Monday, etc.
    const luxonWeekday = (dayOfWeek === 0 ? 7 : dayOfWeek) as WeekdayNumbers
    const referenceDate = DateTime.fromObject(
      { weekday: luxonWeekday, hour, minute: 0, second: 0 },
      { zone: timezone }
    )

    const utcDate = referenceDate.toUTC()

    // Convert back to 0-6 format
    let utcDayOfWeek = utcDate.weekday
    if (utcDayOfWeek === 7) utcDayOfWeek = 0

    return {
      dayOfWeek: utcDayOfWeek,
      hour: utcDate.hour,
    }
  }

  /**
   * Convert a UTC day/hour to local day/hour
   */
  static toLocal(
    dayOfWeek: number,
    hour: number,
    timezone: string
  ): { dayOfWeek: number; hour: number } {
    // Create a DateTime in UTC for the given day/hour
    const luxonWeekday = (dayOfWeek === 0 ? 7 : dayOfWeek) as WeekdayNumbers
    const referenceDate = DateTime.fromObject(
      { weekday: luxonWeekday, hour, minute: 0, second: 0 },
      { zone: 'UTC' }
    )

    const localDate = referenceDate.setZone(timezone)

    // Convert back to 0-6 format
    let localDayOfWeek = localDate.weekday
    if (localDayOfWeek === 7) localDayOfWeek = 0

    return {
      dayOfWeek: localDayOfWeek,
      hour: localDate.hour,
    }
  }

  /**
   * Get all hours for a day, converting from UTC to local timezone
   * Returns a map of local hour -> { utcDayOfWeek, utcHour }
   */
  static getLocalHoursMapping(localDayOfWeek: number, timezone: string) {
    const mapping: Array<{ localHour: number; utcDayOfWeek: number; utcHour: number }> = []

    for (let localHour = 0; localHour < 24; localHour++) {
      const utc = this.toUtc(localDayOfWeek, localHour, timezone)
      mapping.push({
        localHour,
        utcDayOfWeek: utc.dayOfWeek,
        utcHour: utc.hour,
      })
    }

    return mapping
  }

  static getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dayOfWeek]
  }

  static formatHour(hour: number): string {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }
}
