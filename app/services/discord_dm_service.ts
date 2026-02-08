import env from '#start/env'

export type SendPlayerDataNudgeInput = {
  discordUserId: string
  playerId: number
  playerName: string
  missingAvailability: boolean
  missingAgents: boolean
}

export type SendMatchAvailabilityNudgeInput = {
  discordUserId: string
  playerName: string
  opponentName: string
  mapName: string
  scheduledForPlayer: string
  playerTimezone: string
  actionPaths: {
    yes: string
    maybe: string
    no: string
  }
}

export type DiscordDmResult = {
  ok: boolean
  externalMessageId?: string
  errorCode?: string
  errorMessage?: string
}

export default class DiscordDmService {
  private botToken: string | undefined
  private appUrl: string | undefined
  private discordApiBaseUrl = 'https://discord.com/api/v10'

  constructor() {
    this.botToken = env.get('DISCORD_BOT_TOKEN')
    this.appUrl = env.get('APP_URL')
  }

  private buildAppLink(path: string): string {
    if (!this.appUrl) {
      return path
    }
    return `${this.appUrl.replace(/\/$/, '')}${path}`
  }

  private buildPlayerDataNudgeMessage(input: SendPlayerDataNudgeInput): string {
    const tasks: string[] = []
    if (input.missingAvailability) {
      tasks.push(`- Set availability: ${this.buildAppLink('/availability')}`)
    }
    if (input.missingAgents) {
      tasks.push(`- Update agent preferences: ${this.buildAppLink('/settings/profile')}`)
    }

    return [
      `Hey ${input.playerName}, quick admin reminder to complete your team data:`,
      '',
      ...tasks,
      '',
      'Thanks.',
    ].join('\n')
  }

  private buildMatchAvailabilityNudgeMessage(input: SendMatchAvailabilityNudgeInput): string {
    return [
      `Hey ${input.playerName}, quick availability check for your upcoming match:`,
      '',
      `- Opponent: ${input.opponentName}`,
      `- Map: ${input.mapName}`,
      `- Your time (${input.playerTimezone}): ${input.scheduledForPlayer}`,
      '',
      'Respond with one click:',
      `- Yes: ${this.buildAppLink(input.actionPaths.yes)}`,
      `- Maybe: ${this.buildAppLink(input.actionPaths.maybe)}`,
      `- No: ${this.buildAppLink(input.actionPaths.no)}`,
      '',
      'Thanks.',
    ].join('\n')
  }

  private getTestModeResult(): DiscordDmResult | null {
    // Keep functional tests deterministic without requiring external Discord infrastructure.
    if (env.get('NODE_ENV') !== 'test') {
      return null
    }

    if (process.env.DISCORD_DM_TEST_MODE === 'fail') {
      return {
        ok: false,
        errorCode: 'discord_dm_test_failure',
        errorMessage: 'Forced failure in test mode',
      }
    }

    if (process.env.DISCORD_DM_TEST_MODE === 'bot_token_missing') {
      return {
        ok: false,
        errorCode: 'discord_bot_token_missing',
        errorMessage: 'Discord bot token is not configured',
      }
    }

    if (process.env.DISCORD_DM_TEST_MODE === 'forbidden') {
      return {
        ok: false,
        errorCode: 'discord_dm_message_http_403',
        errorMessage: 'Cannot send messages to this user',
      }
    }

    if (process.env.DISCORD_DM_TEST_MODE !== 'real') {
      return {
        ok: true,
        externalMessageId: 'test-mode-message-id',
      }
    }

    return null
  }

  private async sendDirectMessage(
    discordUserId: string,
    content: string
  ): Promise<DiscordDmResult> {
    const testModeResult = this.getTestModeResult()
    if (testModeResult) {
      return testModeResult
    }

    if (!this.botToken) {
      return {
        ok: false,
        errorCode: 'discord_bot_token_missing',
        errorMessage: 'Discord bot token is not configured',
      }
    }

    const authHeaders: Record<string, string> = {
      'Authorization': `Bot ${this.botToken}`,
      'Content-Type': 'application/json',
    }

    try {
      const createChannelResponse = await fetch(`${this.discordApiBaseUrl}/users/@me/channels`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          recipient_id: discordUserId,
        }),
      })

      if (!createChannelResponse.ok) {
        const responseText = await createChannelResponse.text()
        return {
          ok: false,
          errorCode: `discord_dm_channel_http_${createChannelResponse.status}`,
          errorMessage: responseText || createChannelResponse.statusText,
        }
      }

      const channelJson = (await createChannelResponse.json()) as Record<string, unknown>
      const channelId = channelJson.id
      if (typeof channelId !== 'string' || channelId.length === 0) {
        return {
          ok: false,
          errorCode: 'discord_dm_channel_missing_id',
          errorMessage: 'Discord did not return a DM channel id',
        }
      }

      const sendMessageResponse = await fetch(
        `${this.discordApiBaseUrl}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            content,
          }),
        }
      )

      if (!sendMessageResponse.ok) {
        const responseText = await sendMessageResponse.text()
        return {
          ok: false,
          errorCode: `discord_dm_message_http_${sendMessageResponse.status}`,
          errorMessage: responseText || sendMessageResponse.statusText,
        }
      }

      const messageJson = (await sendMessageResponse.json()) as Record<string, unknown>
      const messageId = typeof messageJson.id === 'string' ? messageJson.id : undefined

      return {
        ok: true,
        externalMessageId: messageId,
      }
    } catch (error) {
      return {
        ok: false,
        errorCode: 'discord_dm_request_failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown Discord DM error',
      }
    }
  }

  async sendPlayerDataNudge(input: SendPlayerDataNudgeInput): Promise<DiscordDmResult> {
    return this.sendDirectMessage(input.discordUserId, this.buildPlayerDataNudgeMessage(input))
  }

  async sendMatchAvailabilityNudge(
    input: SendMatchAvailabilityNudgeInput
  ): Promise<DiscordDmResult> {
    return this.sendDirectMessage(
      input.discordUserId,
      this.buildMatchAvailabilityNudgeMessage(input)
    )
  }
}
