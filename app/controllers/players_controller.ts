import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import WeeklyAvailability from '#models/weekly_availability'
import TimezoneService from '#services/timezone_service'
import PlayerNudgeService from '#services/player_nudge_service'
import { createPlayerValidator, updatePlayerValidator } from '#validators/player_validator'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import * as fs from 'node:fs'
import { AGENTS_BY_ROLE, AGENT_LOOKUP } from '#constants/agents'

const toBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 'on' || value === 1 || value === '1'

export default class PlayersController {
  async index({ view, auth }: HttpContext) {
    const players = await User.query().orderBy('fullName', 'asc')
    return view.render('pages/players/index', {
      players,
      viewerTimezone: auth.user?.timezone,
    })
  }

  async create({ view }: HttpContext) {
    return view.render('pages/players/create')
  }

  async store({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(createPlayerValidator)

    let logoFilename: string | null = null
    const logo = request.file('logo', {
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    })

    if (logo) {
      if (!logo.isValid) {
        session.flash('error', logo.errors[0]?.message || 'Invalid logo image')
        return response.redirect().back()
      }

      logoFilename = `${cuid()}.${logo.extname}`
      const uploadsDir = app.makePath('storage/uploads/players')

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      await logo.move(uploadsDir, { name: logoFilename })
    }

    await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      role: data.role,
      timezone: data.timezone,
      logoFilename,
      trackerggUsername: data.trackerggUsername || null,
      isOnRoster: toBoolean(data.isOnRoster),
    })

    session.flash('success', 'Player created successfully')
    return response.redirect('/players')
  }

  async show({ params, view, auth }: HttpContext) {
    const player = await User.findOrFail(params.id)

    let availabilityGrid = null
    let availabilityHours = null

    // Load availability data for admins
    if (auth.user?.isAdmin) {
      const timezone = player.timezone
      const availabilities = await WeeklyAvailability.query().where('userId', player.id)

      const availableSlots = new Set(
        availabilities.filter((a) => a.isAvailable).map((a) => `${a.dayOfWeek}-${a.hour}`)
      )

      const days = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun
      availabilityHours = Array.from({ length: 12 }, (_, i) => i + 12)

      availabilityGrid = days.map((localDay) => {
        const hoursMapping = TimezoneService.getLocalHoursMapping(localDay, timezone)

        return {
          dayOfWeek: localDay,
          dayName: TimezoneService.getDayName(localDay),
          hours: hoursMapping.map((mapping) => ({
            localHour: mapping.localHour,
            isAvailable: availableSlots.has(`${mapping.utcDayOfWeek}-${mapping.utcHour}`),
          })),
        }
      })
    }

    return view.render('pages/players/show', {
      player,
      availabilityGrid,
      availabilityHours,
      agentLookup: AGENT_LOOKUP,
      viewerTimezone: auth.user?.timezone,
    })
  }

  async edit({ params, view }: HttpContext) {
    const player = await User.findOrFail(params.id)
    return view.render('pages/players/edit', {
      player,
      agentGroups: AGENTS_BY_ROLE,
      agentLookup: AGENT_LOOKUP,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const player = await User.findOrFail(params.id)
    const data = await request.validateUsing(updatePlayerValidator)

    player.fullName = data.fullName
    player.email = data.email
    player.role = data.role
    player.timezone = data.timezone
    player.trackerggUsername = data.trackerggUsername || null
    player.isOnRoster = toBoolean(data.isOnRoster)
    player.agentPrefs = Array.from(new Set(data.agents))

    if (data.password) {
      player.password = data.password
    }

    const logo = request.file('logo', {
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    })

    if (logo) {
      if (!logo.isValid) {
        session.flash('error', logo.errors[0]?.message || 'Invalid logo image')
        return response.redirect().back()
      }

      if (player.logoFilename) {
        const oldPath = app.makePath('storage/uploads/players', player.logoFilename)
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath)
        }
      }

      const logoFilename = `${cuid()}.${logo.extname}`
      const uploadsDir = app.makePath('storage/uploads/players')

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      await logo.move(uploadsDir, { name: logoFilename })
      player.logoFilename = logoFilename
    }

    await player.save()

    session.flash('success', 'Player updated successfully')
    return response.redirect('/players')
  }

  async destroy({ params, request, response, session }: HttpContext) {
    const player = await User.findOrFail(params.id)

    if (player.logoFilename) {
      const logoPath = app.makePath('storage/uploads/players', player.logoFilename)
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath)
      }
    }

    if (request.header('HX-Request')) {
      await player.delete()
      return response.send('')
    }

    await player.delete()
    session.flash('success', 'Player deleted successfully')
    return response.redirect('/players')
  }

  async destroyLogo({ params, request, response, view, session }: HttpContext) {
    const player = await User.findOrFail(params.id)

    if (player.logoFilename) {
      const logoPath = app.makePath('storage/uploads/players', player.logoFilename)
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath)
      }
      player.logoFilename = null
      await player.save()
    }

    if (request.header('HX-Request')) {
      return view.render('partials/player_logo', { player, editable: true })
    }

    session.flash('success', 'Logo removed successfully')
    return response.redirect(`/players/${params.id}/edit`)
  }

  async nudge({ params, auth, request, response, session, view }: HttpContext) {
    const adminUser = auth.user!
    const player = await User.findOrFail(params.id)

    const nudgeService = new PlayerNudgeService()
    const result = await nudgeService.sendProfileDataNudge(adminUser, player)

    const nudgeTone =
      result.status === 'sent' ? 'success' : result.status === 'blocked' ? 'warning' : 'error'
    const disableNudge = result.status === 'blocked'

    if (request.header('HX-Request')) {
      return view.render('partials/player_nudge_controls', {
        player,
        nudgeMessage: result.message,
        nudgeTone,
        disableNudge,
      })
    }

    if (result.status === 'sent') {
      session.flash('success', result.message)
    } else {
      session.flash('error', result.message)
    }

    return response.redirect().back()
  }
}
