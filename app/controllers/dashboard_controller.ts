import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  async index({ view }: HttpContext) {
    return view.render('pages/dashboard/index')
  }
}
