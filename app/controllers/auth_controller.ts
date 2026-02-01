import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import { loginValidator, changePasswordValidator } from '#validators/auth_validator'

export default class AuthController {
  async showLogin({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  async login({ request, auth, session, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await User.verifyCredentials(email, password)
      await auth.use('web').login(user)
      return response.redirect('/dashboard')
    } catch {
      session.flash('error', 'Invalid email or password')
      return response.redirect('/login')
    }
  }

  async logout({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/login')
  }

  async showChangePassword({ view }: HttpContext) {
    return view.render('pages/auth/change_password')
  }

  async changePassword({ request, auth, session, response }: HttpContext) {
    const data = await request.validateUsing(changePasswordValidator)

    if (data.new_password !== data.new_password_confirmation) {
      return response.status(422).send('New passwords do not match')
    }

    const user = auth.user!

    const isValid = await hash.verify(user.password, data.current_password)
    if (!isValid) {
      return response.status(422).send('Current password is incorrect')
    }

    user.password = data.new_password
    await user.save()

    session.flash('success', 'Password changed successfully')
    response.header('HX-Redirect', '/dashboard')
    return response.send('')
  }
}
