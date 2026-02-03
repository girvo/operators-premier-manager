import env from '#start/env'
import Match from '#models/match'
import User from '#models/user'

interface DiscordEmbed {
  title: string
  description: string
  color: number
  fields: { name: string; value: string; inline?: boolean }[]
  timestamp?: string
}

interface DiscordWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
}

export default class DiscordNotificationService {
  private webhookUrl: string | undefined

  constructor() {
    this.webhookUrl = env.get('DISCORD_WEBHOOK_URL')
  }

  async sendMatchReminder(match: Match, type: '24h' | '1h'): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('DISCORD_WEBHOOK_URL not configured, skipping notification')
      return false
    }

    const rosterMembers = await User.query().where('isOnRoster', true).whereNotNull('discordId')

    const mentions = rosterMembers.map((user) => `<@${user.discordId}>`).join(' ')

    const title = type === '24h' ? 'Match in 24 hours!' : 'Match in 1 hour!'

    const color = type === '24h' ? 0x3498db : 0xe74c3c // Blue for 24h, Red for 1h

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

    const payload: DiscordWebhookPayload = {
      content: mentions || undefined,
      embeds: [
        {
          title,
          description: `Get ready for your upcoming ${match.matchType} match!`,
          color,
          fields,
          timestamp: match.scheduledAt.toISO() ?? undefined,
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
