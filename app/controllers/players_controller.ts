import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { createPlayerValidator, updatePlayerValidator } from '#validators/player_validator'

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

    await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      role: data.role,
      timezone: data.timezone,
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

    if (data.password) {
      player.password = data.password
    }

    await player.save()

    session.flash('success', 'Player updated successfully')
    return response.redirect('/players')
  }

  async destroy({ params, request, response, session }: HttpContext) {
    const player = await User.findOrFail(params.id)

    // Handle HTMx requests
    if (request.header('HX-Request')) {
      await player.delete()
      return response.send('')
    }

    await player.delete()
    session.flash('success', 'Player deleted successfully')
    return response.redirect('/players')
  }
}
