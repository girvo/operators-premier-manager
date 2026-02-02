import type { HttpContext } from '@adonisjs/core/http'
import Map from '#models/map'

export default class MapsController {
  async index({ view }: HttpContext) {
    const maps = await Map.query().orderBy('name', 'asc')
    return view.render('pages/admin/maps/index', { maps })
  }

  async toggleActive({ params, session, response }: HttpContext) {
    const map = await Map.findOrFail(params.id)
    map.isActive = !map.isActive
    await map.save()
    session.flash('success', `${map.name} ${map.isActive ? 'added to' : 'removed from'} rotation.`)
    return response.redirect('/admin/maps')
  }
}
