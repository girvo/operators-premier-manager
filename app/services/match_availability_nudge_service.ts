import { DateTime } from 'luxon'
import Match from '#models/match'
import MatchAvailability from '#models/match_availability'
import MatchAvailabilityNudge from '#models/match_availability_nudge'
import User from '#models/user'
import DiscordDmService from '#services/discord_dm_service'
import MatchAvailabilityResponseTokenService from '#services/match_availability_response_token_service'
import type { MatchAvailabilityResponseStatus } from '#services/match_availability_response_token_service'

const COOLDOWN_HOURS = 24
const RESPONSE_STATUSES: MatchAvailabilityResponseStatus[] = ['yes', 'maybe', 'no']

type SendResultStatus = 'sent' | 'partial' | 'blocked' | 'failed'

export type MatchAvailabilityNudgeOutcome = {
  status: SendResultStatus
  message: string
  targetCount: number
  sentCount: number
  skippedCount: number
  failedCount: number
}

type NudgeFailureClassification = {
  status: 'blocked' | 'failed'
  errorCode: string
  message: string
}

export default class MatchAvailabilityNudgeService {
  constructor(
    private dmService: DiscordDmService = new DiscordDmService(),
    private tokenService: MatchAvailabilityResponseTokenService = new MatchAvailabilityResponseTokenService()
  ) {}

  private classifyDmFailure(dmResult: {
    errorCode?: string
    errorMessage?: string
  }): NudgeFailureClassification {
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

  private async getEligibleNonResponders(match: Match): Promise<User[]> {
    const responded = await MatchAvailability.query()
      .where('matchId', match.id)
      .whereIn('status', RESPONSE_STATUSES)
      .select('userId')

    const respondedUserIds = new Set(responded.map((row) => row.userId))

    const eligiblePlayers = await User.query()
      .where('isOnRoster', true)
      .where('approvalStatus', 'approved')
      .whereNotNull('discordId')
      .orderBy('fullName', 'asc')

    return eligiblePlayers.filter((player) => !respondedUserIds.has(player.id))
  }

  private async recordAttempt(input: {
    matchId: number
    userId: number
    adminUserId: number
    status: 'sent' | 'blocked' | 'failed'
    forced: boolean
    errorCode: string | null
    errorMessage: string | null
    sentAt?: DateTime | null
  }) {
    await MatchAvailabilityNudge.create({
      matchId: input.matchId,
      userId: input.userId,
      adminUserId: input.adminUserId,
      status: input.status,
      forced: input.forced,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      sentAt: input.sentAt ?? null,
    })
  }

  private formatMatchTimeForPlayer(
    match: Match,
    player: User
  ): {
    formattedTime: string
    timezone: string
  } {
    const localTime = match.scheduledAt.setZone(player.timezone)

    if (!localTime.isValid) {
      return {
        formattedTime: match.scheduledAt.toUTC().toFormat("cccc, LLL d, yyyy 'at' h:mm a"),
        timezone: 'UTC',
      }
    }

    return {
      formattedTime: localTime.toFormat("cccc, LLL d, yyyy 'at' h:mm a"),
      timezone: player.timezone,
    }
  }

  private buildActionPath(
    match: Match,
    player: User,
    status: MatchAvailabilityResponseStatus
  ): string {
    const token = this.tokenService.createToken({
      matchId: match.id,
      userId: player.id,
      status,
    })

    return `/match-availability/respond/${token}`
  }

  private async isOnCooldown(match: Match, player: User, now: DateTime): Promise<boolean> {
    const lastSent = await MatchAvailabilityNudge.query()
      .where('matchId', match.id)
      .where('userId', player.id)
      .where('status', 'sent')
      .orderBy('sentAt', 'desc')
      .orderBy('id', 'desc')
      .first()

    const sentAt = lastSent?.sentAt ?? lastSent?.createdAt ?? null
    if (!sentAt) {
      return false
    }

    const cooldownUntil = sentAt.plus({ hours: COOLDOWN_HOURS })
    return cooldownUntil > now
  }

  async sendNonResponderNudges(
    adminUser: User,
    match: Match,
    options: { force: boolean }
  ): Promise<MatchAvailabilityNudgeOutcome> {
    const now = DateTime.now()
    if (match.scheduledAt <= now) {
      return {
        status: 'blocked',
        message: 'Cannot send nudges for a past match.',
        targetCount: 0,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
      }
    }

    const recipients = await this.getEligibleNonResponders(match)
    if (recipients.length === 0) {
      return {
        status: 'blocked',
        message: 'No eligible non-responders to nudge.',
        targetCount: 0,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
      }
    }

    let sentCount = 0
    let skippedCount = 0
    let failedCount = 0

    for (const player of recipients) {
      if (!options.force && (await this.isOnCooldown(match, player, now))) {
        skippedCount += 1
        await this.recordAttempt({
          matchId: match.id,
          userId: player.id,
          adminUserId: adminUser.id,
          status: 'blocked',
          forced: false,
          errorCode: 'cooldown_active',
          errorMessage: 'Cooldown active for this match/player nudge',
        })
        continue
      }

      const matchContext = this.formatMatchTimeForPlayer(match, player)
      const dmResult = await this.dmService.sendMatchAvailabilityNudge({
        discordUserId: player.discordId!,
        playerName: player.fullName ?? player.discordUsername ?? player.email,
        matchType: match.matchType,
        opponentName: match.matchType === 'scrim' ? (match.opponentName ?? 'TBD') : null,
        mapName: match.valorantMap ?? match.map ?? 'TBD',
        scheduledForPlayer: matchContext.formattedTime,
        playerTimezone: matchContext.timezone,
        actionPaths: {
          yes: this.buildActionPath(match, player, 'yes'),
          maybe: this.buildActionPath(match, player, 'maybe'),
          no: this.buildActionPath(match, player, 'no'),
        },
      })

      if (!dmResult.ok) {
        const failure = this.classifyDmFailure(dmResult)

        if (failure.status === 'blocked') {
          skippedCount += 1
        } else {
          failedCount += 1
        }

        await this.recordAttempt({
          matchId: match.id,
          userId: player.id,
          adminUserId: adminUser.id,
          status: failure.status,
          forced: options.force,
          errorCode: failure.errorCode,
          errorMessage: dmResult.errorMessage ?? 'Unknown Discord DM send failure',
        })
        continue
      }

      sentCount += 1
      await this.recordAttempt({
        matchId: match.id,
        userId: player.id,
        adminUserId: adminUser.id,
        status: 'sent',
        forced: options.force,
        errorCode: null,
        errorMessage: null,
        sentAt: now,
      })
    }

    const targetCount = recipients.length
    const summaryParts = [
      `Sent ${sentCount} nudge${sentCount === 1 ? '' : 's'}.`,
      `Skipped ${skippedCount}.`,
      `Failed ${failedCount}.`,
    ]

    if (sentCount === 0 && failedCount > 0) {
      return {
        status: 'failed',
        message: summaryParts.join(' '),
        targetCount,
        sentCount,
        skippedCount,
        failedCount,
      }
    }

    if (sentCount === 0) {
      return {
        status: 'blocked',
        message: summaryParts.join(' '),
        targetCount,
        sentCount,
        skippedCount,
        failedCount,
      }
    }

    if (failedCount > 0 || skippedCount > 0) {
      return {
        status: 'partial',
        message: summaryParts.join(' '),
        targetCount,
        sentCount,
        skippedCount,
        failedCount,
      }
    }

    return {
      status: 'sent',
      message: summaryParts.join(' '),
      targetCount,
      sentCount,
      skippedCount,
      failedCount,
    }
  }
}
