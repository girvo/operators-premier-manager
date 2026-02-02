import type { HttpContext } from '@adonisjs/core/http'
import { updateProfileValidator } from '#validators/settings_validator'

export default class SettingsController {
  async showProfile({ view }: HttpContext) {
    return view.render('pages/settings/profile')
  }

  async updateProfile({ request, auth, session, response }: HttpContext) {
    const data = await request.validateUsing(updateProfileValidator)
    const user = auth.user!

    if (data.fullName !== undefined) {
      user.fullName = data.fullName || null
    }
    user.timezone = data.timezone
    if (data.trackerggUsername !== undefined) {
      user.trackerggUsername = data.trackerggUsername || null
    }

    await user.save()

    session.flash('success', 'Profile updated successfully')
    response.header('HX-Redirect', '/settings/profile')
    return response.send('')
  }
}
