import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import User from '#models/user'
import SlotsService, { ALLOWED_BETS, STARTING_BALANCE } from '#services/slots_service'

const spinValidator = vine.compile(
  vine.object({
    bet: vine.number().in([...ALLOWED_BETS]),
  })
)

const resetValidator = vine.compile(
  vine.object({
    userId: vine.number().positive(),
  })
)

export default class SlotsController {
  async spin({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { bet } = await request.validateUsing(spinValidator)

    if (user.slotBalance < bet) {
      return response.status(400).json({
        error: `Not enough credits. Balance: $${user.slotBalance}.`,
        balance: user.slotBalance,
      })
    }

    const result = SlotsService.spin(bet)
    user.slotBalance = user.slotBalance - bet + result.payout
    await user.save()

    return response.json({
      reels: result.reels,
      payout: result.payout,
      win: result.win,
      payoutLabel: result.payoutLabel,
      balance: user.slotBalance,
      bet,
    })
  }

  async reset({ request, response, session }: HttpContext) {
    const { userId } = await request.validateUsing(resetValidator)
    const target = await User.findOrFail(userId)
    target.slotBalance = STARTING_BALANCE
    await target.save()
    session.flash(
      'success',
      `${target.fullName ?? target.email}'s slot balance reset to $${STARTING_BALANCE}.`
    )
    return response.redirect().back()
  }
}
