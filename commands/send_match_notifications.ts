import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import Match from '#models/match'
import MatchNotification from '#models/match_notification'
import DiscordNotificationService from '#services/discord_notification_service'

export default class SendMatchNotifications extends BaseCommand {
  static commandName = 'notifications:send'
  static description = 'Send Discord notifications for upcoming matches'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Send a test notification to verify webhook works' })
  declare test: boolean

  @flags.boolean({
    description:
      "Send notifications for any upcoming match (1-24h away) that hasn't been manually notified",
  })
  declare catchup: boolean

  @flags.number({ description: 'Send notification for a specific match regardless of timing' })
  declare matchId: number

  async run() {
    const discordService = new DiscordNotificationService()

    if (this.test) {
      return this.sendTestNotification(discordService)
    }

    if (this.matchId) {
      return this.sendMatchNotification(discordService, this.matchId)
    }

    if (this.catchup) {
      return this.sendCatchupNotifications(discordService)
    }

    const now = DateTime.now()

    // 24h window: 23-25 hours away
    const twentyFourHourStart = now.plus({ hours: 23 })
    const twentyFourHourEnd = now.plus({ hours: 25 })

    // 1h window: 30 minutes to 1.5 hours away
    const oneHourStart = now.plus({ minutes: 30 })
    const oneHourEnd = now.plus({ hours: 1, minutes: 30 })

    // Find matches in 24h window
    const matches24h = await Match.query()
      .where('scheduledAt', '>=', twentyFourHourStart.toSQL()!)
      .where('scheduledAt', '<=', twentyFourHourEnd.toSQL()!)

    // Find matches in 1h window
    const matches1h = await Match.query()
      .where('scheduledAt', '>=', oneHourStart.toSQL()!)
      .where('scheduledAt', '<=', oneHourEnd.toSQL()!)

    let sent = 0
    let skipped = 0

    // Process 24h notifications
    for (const match of matches24h) {
      const existing = await MatchNotification.query()
        .where('matchId', match.id)
        .where('notificationType', '24h')
        .first()

      if (existing) {
        this.logger.info(`Skipping 24h notification for match #${match.id} (already sent)`)
        skipped++
        continue
      }

      // Check for a paired match (official/prac matches come in pairs)
      const pairedMatch = await discordService.findPairedMatch(match)

      const success = await discordService.sendMatchReminder(match, '24h', pairedMatch ?? undefined)
      if (success) {
        await MatchNotification.create({
          matchId: match.id,
          notificationType: '24h',
          sentAt: DateTime.now(),
        })

        if (pairedMatch) {
          await MatchNotification.create({
            matchId: pairedMatch.id,
            notificationType: '24h',
            sentAt: DateTime.now(),
          })
          this.logger.success(`Sent 24h notification for paired matches #${match.id} and #${pairedMatch.id}`)
        } else {
          this.logger.success(`Sent 24h notification for match #${match.id}`)
        }
        sent++
      } else {
        this.logger.error(`Failed to send 24h notification for match #${match.id}`)
      }
    }

    // Process 1h notifications
    for (const match of matches1h) {
      const existing = await MatchNotification.query()
        .where('matchId', match.id)
        .where('notificationType', '1h')
        .first()

      if (existing) {
        this.logger.info(`Skipping 1h notification for match #${match.id} (already sent)`)
        skipped++
        continue
      }

      // Check for a paired match (official/prac matches come in pairs)
      const pairedMatch = await discordService.findPairedMatch(match)

      const success = await discordService.sendMatchReminder(match, '1h', pairedMatch ?? undefined)
      if (success) {
        await MatchNotification.create({
          matchId: match.id,
          notificationType: '1h',
          sentAt: DateTime.now(),
        })

        if (pairedMatch) {
          await MatchNotification.create({
            matchId: pairedMatch.id,
            notificationType: '1h',
            sentAt: DateTime.now(),
          })
          this.logger.success(`Sent 1h notification for paired matches #${match.id} and #${pairedMatch.id}`)
        } else {
          this.logger.success(`Sent 1h notification for match #${match.id}`)
        }
        sent++
      } else {
        this.logger.error(`Failed to send 1h notification for match #${match.id}`)
      }
    }

    this.logger.info(`Done. Sent: ${sent}, Skipped: ${skipped}`)
  }

  private async sendTestNotification(discordService: DiscordNotificationService) {
    this.logger.info('Sending test notification...')

    // Create a fake match for testing
    const fakeMatch = new Match()
    fakeMatch.id = 0
    fakeMatch.scheduledAt = DateTime.now().plus({ hours: 24 })
    fakeMatch.opponentName = 'Test Opponent'
    fakeMatch.matchType = 'scrim'
    fakeMatch.map = 'Ascent'

    const success = await discordService.sendMatchReminder(fakeMatch, '24h')
    if (success) {
      this.logger.success('Test notification sent successfully!')
    } else {
      this.logger.error('Failed to send test notification. Check DISCORD_WEBHOOK_URL in .env')
    }
  }

  private async sendMatchNotification(discordService: DiscordNotificationService, matchId: number) {
    const match = await Match.find(matchId)

    if (!match) {
      this.logger.error(`Match #${matchId} not found`)
      return
    }

    if (match.scheduledAt <= DateTime.now()) {
      this.logger.error(`Cannot send notification for past match #${matchId}`)
      return
    }

    const existing = await MatchNotification.query()
      .where('matchId', match.id)
      .where('notificationType', 'manual')
      .first()

    if (existing) {
      this.logger.info(`Skipping manual notification for match #${match.id} (already sent)`)
      return
    }

    // Check for a paired match (official/prac matches come in pairs)
    const pairedMatch = await discordService.findPairedMatch(match)

    const success = await discordService.sendMatchReminder(match, 'manual', pairedMatch ?? undefined)
    if (success) {
      await MatchNotification.create({
        matchId: match.id,
        notificationType: 'manual',
        sentAt: DateTime.now(),
      })

      if (pairedMatch) {
        await MatchNotification.create({
          matchId: pairedMatch.id,
          notificationType: 'manual',
          sentAt: DateTime.now(),
        })
        this.logger.success(`Sent manual notification for paired matches #${match.id} and #${pairedMatch.id}`)
      } else {
        this.logger.success(`Sent manual notification for match #${match.id}`)
      }
    } else {
      this.logger.error(`Failed to send manual notification for match #${match.id}`)
    }
  }

  private async sendCatchupNotifications(discordService: DiscordNotificationService) {
    const now = DateTime.now()
    const oneHourAway = now.plus({ hours: 1 })
    const twentyFourHoursAway = now.plus({ hours: 24 })

    // Find upcoming matches in the 1-24h window
    const upcomingMatches = await Match.query()
      .where('scheduledAt', '>', oneHourAway.toSQL()!)
      .where('scheduledAt', '<=', twentyFourHoursAway.toSQL()!)

    let sent = 0
    let skipped = 0

    for (const match of upcomingMatches) {
      const existing = await MatchNotification.query()
        .where('matchId', match.id)
        .where('notificationType', 'manual')
        .first()

      if (existing) {
        this.logger.info(
          `Skipping catchup notification for match #${match.id} (already manually notified)`
        )
        skipped++
        continue
      }

      // Check for a paired match (official/prac matches come in pairs)
      const pairedMatch = await discordService.findPairedMatch(match)

      const success = await discordService.sendMatchReminder(match, 'manual', pairedMatch ?? undefined)
      if (success) {
        await MatchNotification.create({
          matchId: match.id,
          notificationType: 'manual',
          sentAt: DateTime.now(),
        })

        if (pairedMatch) {
          await MatchNotification.create({
            matchId: pairedMatch.id,
            notificationType: 'manual',
            sentAt: DateTime.now(),
          })
          this.logger.success(`Sent catchup notification for paired matches #${match.id} and #${pairedMatch.id}`)
        } else {
          this.logger.success(`Sent catchup notification for match #${match.id}`)
        }
        sent++
      } else {
        this.logger.error(`Failed to send catchup notification for match #${match.id}`)
      }
    }

    this.logger.info(`Catchup done. Sent: ${sent}, Skipped: ${skipped}`)
  }
}
