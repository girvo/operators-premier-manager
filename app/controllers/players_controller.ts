import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { createPlayerValidator, updatePlayerValidator } from '#validators/player_validator'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import * as fs from 'node:fs'

export default class PlayersController {
  async index({ view }: HttpContext) {
    const players = await User.query().orderBy('fullName', 'asc')
    return view.render('pages/players/index', { players })
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
    })

    session.flash('success', 'Player created successfully')
    return response.redirect('/players')
  }

  async show({ params, view }: HttpContext) {
    const player = await User.findOrFail(params.id)
    return view.render('pages/players/show', { player })
  }

  async edit({ params, view }: HttpContext) {
    const player = await User.findOrFail(params.id)
    return view.render('pages/players/edit', { player })
  }

  async update({ params, request, response, session }: HttpContext) {
    const player = await User.findOrFail(params.id)
    const data = await request.validateUsing(updatePlayerValidator)

    player.fullName = data.fullName
    player.email = data.email
    player.role = data.role
    player.timezone = data.timezone
    player.trackerggUsername = data.trackerggUsername || null

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

      // Delete old logo if exists
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

    // Delete logo file if exists
    if (player.logoFilename) {
      const logoPath = app.makePath('storage/uploads/players', player.logoFilename)
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath)
      }
    }

    // Handle HTMx requests
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

    // Handle HTMx requests - return the updated logo display partial
    if (request.header('HX-Request')) {
      return view.render('partials/player_logo', { player, editable: true })
    }

    session.flash('success', 'Logo removed successfully')
    return response.redirect(`/players/${params.id}/edit`)
  }
}
