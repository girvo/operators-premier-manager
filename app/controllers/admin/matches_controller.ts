import type { HttpContext } from '@adonisjs/core/http'
import Match from '#models/match'
import { bulkDeleteMatchesValidator } from '#validators/bulk_delete_matches_validator'
import { DateTime } from 'luxon'

export default class MatchesController {
  async bulkDestroy({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(bulkDeleteMatchesValidator)

    const pending = await Match.query()
      .whereIn('id', data.matchIds)
      .where('scheduledAt', '>', DateTime.now().toSQL()!)
      .whereNull('result')

    for (const match of pending) {
      await match.delete()
    }

    session.flash('success', `${pending.length} match${pending.length === 1 ? '' : 'es'} deleted.`)
    return response.json({ success: true, deleted: pending.length })
  }
}
