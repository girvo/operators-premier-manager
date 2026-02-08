import { DateTime } from 'luxon'
import PlayerNudge from '#models/player_nudge'
import User from '#models/user'
import WeeklyAvailability from '#models/weekly_availability'
import DiscordDmService from '#services/discord_dm_service'

const PROFILE_DATA_MISSING_REASON = 'profile_data_missing'
const COOLDOWN_HOURS = 24

type MissingDataState = {
  missingAvailability: boolean
  missingAgents: boolean
}

export type PlayerNudgeOutcome =
  | {
      status: 'sent'
      message: string
      errorCode: null
      missingAvailability: boolean
      missingAgents: boolean
    }
  | {
      status: 'blocked'
      message: string
      errorCode: string
      missingAvailability: boolean
      missingAgents: boolean
      cooldownUntil: DateTime | null
    }
  | {
      status: 'failed'
      message: string
      errorCode: string
      missingAvailability: boolean
      missingAgents: boolean
    }

export default class PlayerNudgeService {
  constructor(private dmService: DiscordDmService = new DiscordDmService()) {}

  private classifyDmFailure(dmResult: { errorCode?: string; errorMessage?: string }): {
    status: 'blocked' | 'failed'
    errorCode: string
    message: string
  } {
    const errorCode = dmResult.errorCode ?? 'dm_send_failed'
    const errorMessage = dmResult.errorMessage ?? 'Unknown DM send failure'

    if (errorCode === 'discord_bot_token_missing') {
      return {
        status: 'blocked',
        errorCode,
        message: 'Cannot send nudge: DISCORD_BOT_TOKEN is not configured.',
      }
    }

    if (errorCode.endsWith('_http_401')) {
      return {
        status: 'blocked',
        errorCode,
        message: 'Cannot send nudge: Discord bot authentication failed.',
      }
    }

    if (errorCode.endsWith('_http_403')) {
      return {
        status: 'blocked',
        errorCode,
        message: 'Cannot send nudge: Discord rejected the DM for this user.',
      }
    }

    if (errorCode.endsWith('_http_404')) {
      return {
        status: 'blocked',
        errorCode,
        message: 'Cannot send nudge: Discord user could not be found.',
      }
    }

    return {
      status: 'failed',
      errorCode,
      message: `Failed to send nudge: ${errorMessage}.`,
    }
  }

  private formatRemaining(cooldownUntil: DateTime, now: DateTime): string {
    const remainingMinutes = Math.max(1, Math.ceil(cooldownUntil.diff(now, 'minutes').minutes))
    const hours = Math.floor(remainingMinutes / 60)
    const minutes = remainingMinutes % 60

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h`
    return `${minutes}m`
  }

  private async getMissingData(targetUser: User): Promise<MissingDataState> {
    const availabilityCountRow = await WeeklyAvailability.query()
      .where('userId', targetUser.id)
      .count('* as total')
      .first()

    const availabilityCount = Number(availabilityCountRow?.$extras.total ?? 0)

    return {
      missingAvailability: availabilityCount === 0,
      missingAgents: (targetUser.agentPrefs?.length ?? 0) === 0,
    }
  }

  private async recordAttempt(
    targetUser: User,
    adminUser: User,
    status: 'sent' | 'blocked' | 'failed',
    missingData: MissingDataState,
    errorCode: string | null,
    errorMessage: string | null,
    sentAt: DateTime | null = null
  ) {
    await PlayerNudge.create({
      userId: targetUser.id,
      adminUserId: adminUser.id,
      reason: PROFILE_DATA_MISSING_REASON,
      status,
      missingAvailability: missingData.missingAvailability,
      missingAgents: missingData.missingAgents,
      errorCode,
      errorMessage,
      sentAt,
    })
  }

  async sendProfileDataNudge(adminUser: User, targetUser: User): Promise<PlayerNudgeOutcome> {
    const missingData = await this.getMissingData(targetUser)

    if (!targetUser.isOnRoster) {
      await this.recordAttempt(
        targetUser,
        adminUser,
        'blocked',
        missingData,
        'target_not_on_roster',
        'Target player is not on roster'
      )

      return {
        status: 'blocked',
        errorCode: 'target_not_on_roster',
        message: 'Cannot nudge: player is not on roster.',
        cooldownUntil: null,
        ...missingData,
      }
    }

    if (!targetUser.isApproved) {
      await this.recordAttempt(
        targetUser,
        adminUser,
        'blocked',
        missingData,
        'target_not_approved',
        'Target player is not approved'
      )

      return {
        status: 'blocked',
        errorCode: 'target_not_approved',
        message: 'Cannot nudge: player is not approved.',
        cooldownUntil: null,
        ...missingData,
      }
    }

    if (!missingData.missingAvailability && !missingData.missingAgents) {
      await this.recordAttempt(
        targetUser,
        adminUser,
        'blocked',
        missingData,
        'no_missing_data',
        'Target player has no missing profile data'
      )

      return {
        status: 'blocked',
        errorCode: 'no_missing_data',
        message: 'No nudge needed: player has already filled availability and agent preferences.',
        cooldownUntil: null,
        ...missingData,
      }
    }

    if (!targetUser.discordId) {
      await this.recordAttempt(
        targetUser,
        adminUser,
        'blocked',
        missingData,
        'missing_discord_id',
        'Target player has no linked Discord account'
      )

      return {
        status: 'blocked',
        errorCode: 'missing_discord_id',
        message: 'Cannot nudge: player has no linked Discord account.',
        cooldownUntil: null,
        ...missingData,
      }
    }

    const lastSentNudge = await PlayerNudge.query()
      .where('userId', targetUser.id)
      .where('reason', PROFILE_DATA_MISSING_REASON)
      .where('status', 'sent')
      .orderBy('sentAt', 'desc')
      .orderBy('id', 'desc')
      .first()

    const now = DateTime.now()
    const sentAt = lastSentNudge?.sentAt ?? lastSentNudge?.createdAt ?? null
    if (sentAt) {
      const cooldownUntil = sentAt.plus({ hours: COOLDOWN_HOURS })
      if (cooldownUntil > now) {
        const remaining = this.formatRemaining(cooldownUntil, now)

        await this.recordAttempt(
          targetUser,
          adminUser,
          'blocked',
          missingData,
          'cooldown_active',
          `Cooldown active until ${cooldownUntil.toISO()}`
        )

        return {
          status: 'blocked',
          errorCode: 'cooldown_active',
          message: `On cooldown (${remaining} left).`,
          cooldownUntil,
          ...missingData,
        }
      }
    }

    const dmResult = await this.dmService.sendPlayerDataNudge({
      discordUserId: targetUser.discordId,
      playerId: targetUser.id,
      playerName: targetUser.fullName ?? targetUser.discordUsername ?? targetUser.email,
      missingAvailability: missingData.missingAvailability,
      missingAgents: missingData.missingAgents,
    })

    if (!dmResult.ok) {
      const failure = this.classifyDmFailure(dmResult)

      await this.recordAttempt(
        targetUser,
        adminUser,
        failure.status,
        missingData,
        failure.errorCode,
        dmResult.errorMessage ?? 'Unknown DM send failure'
      )

      if (failure.status === 'blocked') {
        return {
          status: 'blocked',
          errorCode: failure.errorCode,
          message: failure.message,
          cooldownUntil: null,
          ...missingData,
        }
      }

      return {
        status: 'failed',
        errorCode: failure.errorCode,
        message: failure.message,
        ...missingData,
      }
    }

    await this.recordAttempt(targetUser, adminUser, 'sent', missingData, null, null, now)

    return {
      status: 'sent',
      errorCode: null,
      message: 'Nudge sent just now.',
      ...missingData,
    }
  }
}
