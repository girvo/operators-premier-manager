import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Match from '#models/match'
import MatchStatsSyncService from '#services/match_stats_sync_service'

export default class ResyncValorantMatches extends BaseCommand {
  static commandName = 'matches:resync-valorant'
  static description =
    'Re-sync full player stats for matches that already have a stored Valorant match id'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({ description: 'Only re-sync one match by internal match id' })
  declare matchId: number | undefined

  @flags.number({ description: 'Process at most N matches (for staged backfills)' })
  declare limit: number | undefined

  @flags.number({
    description: 'Max Henrik API requests per minute (default: 25, max: 30)',
  })
  declare rpm: number | undefined

  @flags.number({
    description: 'Optional fixed delay in ms between sync requests (overrides --rpm)',
  })
  declare delayMs: number | undefined

  @flags.number({
    description: 'Retries when hitting Henrik API rate limit (429). Default: 2',
  })
  declare rateLimitRetries: number | undefined

  private lastRequestStartedAt = 0

  async run() {
    let query = Match.query().whereNotNull('valorantMatchId').orderBy('id', 'asc')

    if (this.matchId) {
      query = query.where('id', this.matchId)
    }

    if (this.limit && this.limit > 0) {
      query = query.limit(this.limit)
    }

    const matches = await query

    if (matches.length === 0) {
      this.logger.info('No matches found with stored Valorant match ids.')
      return
    }

    let updated = 0
    let failed = 0
    let totalSyncedRows = 0

    const effectiveRpm = this.clamp(this.rpm ?? 25, 1, 30)
    const minIntervalMs =
      this.delayMs && this.delayMs > 0 ? this.delayMs : Math.ceil(60000 / effectiveRpm)
    const maxAttempts = 1 + this.clamp(this.rateLimitRetries ?? 2, 0, 10)

    this.logger.info(`Starting re-sync for ${matches.length} matches...`)
    this.logger.info(
      `Rate-limit guard enabled: ${minIntervalMs}ms minimum interval, ${maxAttempts - 1} retries on 429`
    )

    for (const match of matches) {
      try {
        const result = await this.syncMatchWithRetry(match, minIntervalMs, maxAttempts)
        updated++
        totalSyncedRows += result.syncedPlayersRows
        this.logger.success(
          `Match #${match.id}: synced ${result.syncedPlayersRows} players (${result.rosterAgentRows} roster links)`
        )
      } catch (error) {
        failed++
        const message = error instanceof Error ? error.message : 'Unknown error'
        this.logger.error(`Match #${match.id}: ${message}`)
      }
    }

    this.logger.info(
      `Done. Updated: ${updated}, Failed: ${failed}, Total synced player rows: ${totalSyncedRows}`
    )
  }

  private async syncMatchWithRetry(match: Match, minIntervalMs: number, maxAttempts: number) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.waitForInterval(minIntervalMs)
      this.lastRequestStartedAt = Date.now()

      try {
        return await MatchStatsSyncService.syncFromValorantMatchId(match)
      } catch (error) {
        const shouldRetry = this.isRateLimitError(error) && attempt < maxAttempts
        if (!shouldRetry) {
          throw error
        }

        const message = error instanceof Error ? error.message : 'Unknown error'
        const retryAfterMs = this.extractRetryAfterMs(message) ?? 65_000
        this.logger.info(
          `Match #${match.id}: hit rate limit (attempt ${attempt}/${maxAttempts}). Waiting ${retryAfterMs}ms before retry...`
        )
        await this.sleep(retryAfterMs)
      }
    }

    throw new Error(`Match #${match.id}: exhausted retries`)
  }

  private async waitForInterval(minIntervalMs: number) {
    if (!this.lastRequestStartedAt) return

    const elapsed = Date.now() - this.lastRequestStartedAt
    const waitMs = minIntervalMs - elapsed

    if (waitMs > 0) {
      await this.sleep(waitMs)
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    return /\b429\b/.test(error.message) || /rate limit/i.test(error.message)
  }

  private extractRetryAfterMs(message: string): number | null {
    const millisecondsMatch = message.match(/retry[- ]?after[^0-9]*(\d+)\s*(ms|millisecond)/i)
    if (millisecondsMatch) {
      return Number.parseInt(millisecondsMatch[1], 10)
    }

    const secondsMatch = message.match(/retry[- ]?after[^0-9]*(\d+)\s*(s|sec|second)/i)
    if (secondsMatch) {
      return Number.parseInt(secondsMatch[1], 10) * 1000
    }

    return null
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }
}
