import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class RegistrationsController {
  async index({ view }: HttpContext) {
    const pendingUsers = await User.query()
      .where('approvalStatus', 'pending')
      .orderBy('createdAt', 'asc')

    return view.render('pages/admin/registrations/index', { pendingUsers })
  }

  async approve({ params, session, response }: HttpContext) {
    const user = await User.findOrFail(params.id)

    user.approvalStatus = 'approved'
    await user.save()

    session.flash('success', `${user.fullName || user.email} has been approved.`)
    return response.redirect('/admin/registrations')
  }

  async reject({ params, session, response }: HttpContext) {
    const user = await User.findOrFail(params.id)

    user.approvalStatus = 'rejected'
    await user.save()

    session.flash('success', `${user.fullName || user.email} has been rejected.`)
    return response.redirect('/admin/registrations')
  }
}
