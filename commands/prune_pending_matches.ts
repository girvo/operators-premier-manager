import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import Match from '#models/match'

export default class PrunePendingMatches extends BaseCommand {
  static commandName = 'matches:prune-pending'
  static description = 'Delete all past matches with no result (pending status)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Preview which matches would be deleted without deleting them (default: true)',
    default: true,
  })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Actually delete the matches. Without this flag, runs in dry-run mode.',
  })
  declare force: boolean

  @flags.boolean({
    description: 'Required to run with --force in production environments.',
  })
  declare production: boolean

  async run() {
    const isDryRun = !this.force

    // Production guard: --force alone is blocked in production
    if (app.inProduction && !isDryRun && !this.production) {
      this.logger.error(
        'This command cannot be run with --force in production. ' +
          'Use --force --production to confirm you want to proceed.'
      )
      return
    }

    // Find all past pending matches
    const now = DateTime.now().toSQL()!
    const pastPendingMatches = await Match.query()
      .whereNull('result')
      .where('scheduledAt', '<', now)
      .orderBy('scheduledAt', 'asc')

    if (pastPendingMatches.length === 0) {
      this.logger.info('No past pending matches found.')
      return
    }

    // Display matches to be deleted
    if (isDryRun) {
      this.logger.info(`Would delete ${pastPendingMatches.length} past pending match(es):`)
    } else {
      this.logger.info(`Deleting ${pastPendingMatches.length} past pending match(es):`)
    }

    for (const match of pastPendingMatches) {
      const scheduled = match.scheduledAt.toFormat('yyyy-MM-dd HH:mm')
      const opponent = match.opponentName ?? '(no opponent)'
      this.logger.info(`  - Match #${match.id}: vs "${opponent}" (scheduled: ${scheduled})`)
    }

    if (isDryRun) {
      this.logger.info('\nRun with --force to actually delete these matches.')
      return
    }

    // Actually delete
    const matchIds = pastPendingMatches.map((m) => m.id)
    const deleted = await Match.query().whereIn('id', matchIds).delete()

    const deletedCount = Array.isArray(deleted) ? (deleted[0] ?? 0) : deleted
    this.logger.success(`Deleted ${deletedCount} past pending match(es).`)
  }
}
