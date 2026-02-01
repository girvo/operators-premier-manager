import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class ApprovedMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user

    if (!user) {
      return ctx.response.redirect('/login')
    }

    if (user.isPending) {
      return ctx.response.redirect('/pending-approval')
    }

    if (user.isRejected) {
      await ctx.auth.use('web').logout()
      ctx.session.flash('error', 'Your registration has been rejected.')
      return ctx.response.redirect('/login')
    }

    return next()
  }
}
