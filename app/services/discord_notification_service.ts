import env from '#start/env'
import Match from '#models/match'
import User from '#models/user'
import { DateTime } from 'luxon'

interface DiscordEmbed {
  title: string
  description: string
  color: number
  fields: { name: string; value: string; inline?: boolean }[]
  timestamp?: string
  url?: string
}

interface DiscordWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
}

export default class DiscordNotificationService {
  private webhookUrl: string | undefined
  private appUrl: string | undefined

  constructor() {
    this.webhookUrl = env.get('DISCORD_WEBHOOK_URL')
    this.appUrl = env.get('APP_URL')
  }

  formatTimeRemaining(scheduledAt: DateTime): string {
    const now = DateTime.now()
    const diff = scheduledAt.diff(now, ['hours', 'minutes'])
    const hours = Math.floor(diff.hours)
    const minutes = Math.round(diff.minutes)

    if (hours <= 0 && minutes <= 0) {
      return 'now'
    }

    const parts: string[] = []
    if (hours > 0) {
      parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
    }
    if (minutes > 0) {
      parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
    }

    return parts.join(' and ')
  }

  async sendMatchReminder(match: Match, type: '24h' | '1h' | 'manual'): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('DISCORD_WEBHOOK_URL not configured, skipping notification')
      return false
    }

    const rosterMembers = await User.query().where('isOnRoster', true).whereNotNull('discordId')

    const mentions = rosterMembers.map((user) => `<@${user.discordId}>`).join(' ')

    let title: string
    let color: number

    if (type === 'manual') {
      const timeRemaining = this.formatTimeRemaining(match.scheduledAt)
      title = `Match in ${timeRemaining}!`
      color = 0xf39c12 // Orange for manual
    } else if (type === '24h') {
      title = 'Match in 24 hours!'
      color = 0x3498db // Blue for 24h
    } else {
      title = 'Match in 1 hour!'
      color = 0xe74c3c // Red for 1h
    }

    const discordTimestamp = `<t:${Math.floor(match.scheduledAt.toSeconds())}:F>`

    const fields: { name: string; value: string; inline?: boolean }[] = [
      {
        name: 'Time',
        value: discordTimestamp,
        inline: true,
      },
      {
        name: 'Type',
        value: match.matchType === 'official' ? 'Official' : 'Scrim',
        inline: true,
      },
    ]

    if (match.opponentName) {
      fields.unshift({
        name: 'Opponent',
        value: match.opponentName,
        inline: true,
      })
    }

    if (match.map) {
      fields.push({
        name: 'Map',
        value: match.map,
        inline: true,
      })
    }

    const matchUrl = this.appUrl && match.id ? `${this.appUrl}/matches/${match.id}` : undefined

    const payload: DiscordWebhookPayload = {
      content: mentions || undefined,
      embeds: [
        {
          title,
          description: `Get ready for your upcoming ${match.matchType} match!`,
          color,
          fields,
          timestamp: match.scheduledAt.toISO() ?? undefined,
          url: matchUrl,
        },
      ],
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.error(`Discord webhook failed: ${response.status} ${response.statusText}`)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to send Discord notification:', error)
      return false
    }
  }
}
