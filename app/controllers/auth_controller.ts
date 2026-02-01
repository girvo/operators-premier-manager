import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import { cuid } from '@adonisjs/core/helpers'
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

  async discordRedirect({ ally }: HttpContext) {
    return ally.use('discord').redirect()
  }

  async discordCallback({ ally, auth, session, response }: HttpContext) {
    const discord = ally.use('discord')

    if (discord.accessDenied()) {
      session.flash('error', 'Discord login was cancelled')
      return response.redirect('/login')
    }

    if (discord.hasError()) {
      session.flash('error', 'Unable to authenticate with Discord')
      return response.redirect('/login')
    }

    const discordUser = await discord.user()

    let user = await User.findBy('discordId', discordUser.id)

    if (user) {
      user.discordUsername = discordUser.nickName
      user.discordAvatarUrl = discordUser.avatarUrl
      await user.save()

      if (user.isRejected) {
        session.flash(
          'error',
          'Your registration has been rejected. Contact an admin for assistance.'
        )
        return response.redirect('/login')
      }

      await auth.use('web').login(user)

      if (user.isPending) {
        return response.redirect('/pending-approval')
      }

      return response.redirect('/dashboard')
    }

    if (discordUser.email) {
      const existingUser = await User.findBy('email', discordUser.email)
      if (existingUser) {
        session.flash(
          'error',
          'An account with this email already exists. Contact an admin to link your Discord.'
        )
        return response.redirect('/login')
      }
    }

    user = await User.create({
      email: discordUser.email || `discord_${discordUser.id}@placeholder.local`,
      fullName: discordUser.nickName || discordUser.name,
      password: cuid(), // Random password (they can't use it)
      role: 'player',
      timezone: 'America/Chicago',
      isOnRoster: false,
      discordId: discordUser.id,
      discordUsername: discordUser.nickName,
      discordAvatarUrl: discordUser.avatarUrl,
      approvalStatus: 'pending',
    })

    await auth.use('web').login(user)
    return response.redirect('/pending-approval')
  }

  async showPendingApproval({ view, auth, response }: HttpContext) {
    const user = auth.user!

    if (user.isApproved) {
      return response.redirect('/dashboard')
    }

    if (user.isRejected) {
      return response.redirect('/login')
    }

    return view.render('pages/auth/pending_approval')
  }
}
