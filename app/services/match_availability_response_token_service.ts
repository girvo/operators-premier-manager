import { DateTime } from 'luxon'
import { createHmac, timingSafeEqual } from 'node:crypto'
import vine from '@vinejs/vine'
import env from '#start/env'

export type MatchAvailabilityResponseStatus = 'yes' | 'maybe' | 'no'

type MatchAvailabilityResponseTokenPayload = {
  v: number
  matchId: number
  userId: number
  status: MatchAvailabilityResponseStatus
  exp: number
}

type VerifiedTokenPayload = {
  matchId: number
  userId: number
  status: MatchAvailabilityResponseStatus
  expiresAt: DateTime
}

export type VerifyTokenResult =
  | {
      ok: true
      payload: VerifiedTokenPayload
    }
  | {
      ok: false
      errorCode: 'token_invalid' | 'token_expired'
    }

const TOKEN_VERSION = 1
const TOKEN_TTL_HOURS = 72
const VALID_STATUSES: MatchAvailabilityResponseStatus[] = ['yes', 'maybe', 'no']
const tokenPayloadValidator = vine.compile(
  vine.object({
    v: vine.number().withoutDecimals().in([TOKEN_VERSION]),
    matchId: vine.number().withoutDecimals().positive(),
    userId: vine.number().withoutDecimals().positive(),
    status: vine.enum(VALID_STATUSES),
    exp: vine.number().withoutDecimals().positive(),
  })
)

export default class MatchAvailabilityResponseTokenService {
  private secret: string

  constructor() {
    this.secret = env.get('APP_KEY')
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.secret).update(encodedPayload).digest('base64url')
  }

  createToken(input: {
    matchId: number
    userId: number
    status: MatchAvailabilityResponseStatus
    expiresAt?: DateTime
  }): string {
    const expiresAt = input.expiresAt ?? DateTime.now().plus({ hours: TOKEN_TTL_HOURS })
    const payload: MatchAvailabilityResponseTokenPayload = {
      v: TOKEN_VERSION,
      matchId: input.matchId,
      userId: input.userId,
      status: input.status,
      exp: Math.floor(expiresAt.toSeconds()),
    }

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = this.sign(encodedPayload)
    return `${encodedPayload}.${signature}`
  }

  async verifyToken(token: string): Promise<VerifyTokenResult> {
    const parts = token.split('.')
    if (parts.length !== 2) {
      return {
        ok: false,
        errorCode: 'token_invalid',
      }
    }

    const [encodedPayload, providedSignature] = parts
    if (!encodedPayload || !providedSignature) {
      return {
        ok: false,
        errorCode: 'token_invalid',
      }
    }

    const expectedSignature = this.sign(encodedPayload)
    const providedSignatureBuffer = Buffer.from(providedSignature)
    const expectedSignatureBuffer = Buffer.from(expectedSignature)

    if (providedSignatureBuffer.length !== expectedSignatureBuffer.length) {
      return {
        ok: false,
        errorCode: 'token_invalid',
      }
    }

    if (!timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)) {
      return {
        ok: false,
        errorCode: 'token_invalid',
      }
    }

    let parsedPayload: unknown
    try {
      const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8')
      parsedPayload = JSON.parse(payloadJson)
    } catch {
      return {
        ok: false,
        errorCode: 'token_invalid',
      }
    }

    let payload: MatchAvailabilityResponseTokenPayload
    try {
      payload = await tokenPayloadValidator.validate(parsedPayload)
    } catch {
      return {
        ok: false,
        errorCode: 'token_invalid',
      }
    }

    const expiresAt = DateTime.fromSeconds(payload.exp, { zone: 'utc' })
    if (!expiresAt.isValid) {
      return {
        ok: false,
        errorCode: 'token_invalid',
      }
    }

    if (expiresAt <= DateTime.now()) {
      return {
        ok: false,
        errorCode: 'token_expired',
      }
    }

    return {
      ok: true,
      payload: {
        matchId: payload.matchId,
        userId: payload.userId,
        status: payload.status,
        expiresAt,
      },
    }
  }
}
