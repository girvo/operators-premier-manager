import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user

    if (!user || user.role !== 'admin') {
      ctx.session.flash('error', 'You do not have permission to access this page.')
      return ctx.response.redirect('/dashboard')
    }

    return next()
  }
}
