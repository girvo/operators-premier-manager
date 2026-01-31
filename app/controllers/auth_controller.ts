import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { loginValidator } from '#validators/auth_validator'

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
}
