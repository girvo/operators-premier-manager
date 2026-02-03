import type { HttpContext } from '@adonisjs/core/http'
import { updateProfileValidator } from '#validators/settings_validator'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import * as fs from 'node:fs'

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

    const logo = request.file('logo', {
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    })

    if (logo) {
      if (!logo.isValid) {
        session.flash('error', logo.errors[0]?.message || 'Invalid image')
        return response.redirect().back()
      }

      if (user.logoFilename) {
        const oldPath = app.makePath('storage/uploads/players', user.logoFilename)
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
      user.logoFilename = logoFilename
    }

    await user.save()

    session.flash('success', 'Profile updated successfully')
    return response.redirect('/settings/profile')
  }

  async destroyLogo({ request, auth, session, response, view }: HttpContext) {
    const user = auth.user!

    if (user.logoFilename) {
      const logoPath = app.makePath('storage/uploads/players', user.logoFilename)
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath)
      }
      user.logoFilename = null
      await user.save()
    }

    if (request.header('HX-Request')) {
      return view.render('partials/user_profile_pic', { user, editable: true })
    }

    session.flash('success', 'Profile picture removed')
    return response.redirect('/settings/profile')
  }
}
