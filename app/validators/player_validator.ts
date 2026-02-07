import vine from '@vinejs/vine'
import { AGENT_KEYS } from '#constants/agents'

/**
 * HTML checkboxes send string "true"/"on" when checked, or nothing when unchecked.
 * We use vine.accepted() which handles the checkbox pattern correctly.
 */
const checkboxBoolean = vine.accepted().optional()

export const createPlayerValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(1).maxLength(255),
    email: vine.string().email().maxLength(254),
    password: vine.string().minLength(8),
    role: vine.enum(['admin', 'player']),
    timezone: vine.string().minLength(1),
    trackerggUsername: vine.string().maxLength(100).optional(),
    isOnRoster: checkboxBoolean,
  })
)

export const updatePlayerValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(1).maxLength(255),
    email: vine.string().email().maxLength(254),
    password: vine.string().minLength(8).optional(),
    role: vine.enum(['admin', 'player']),
    timezone: vine.string().minLength(1),
    trackerggUsername: vine.string().maxLength(100).optional(),
    isOnRoster: checkboxBoolean,
    agents: vine.array(vine.enum(AGENT_KEYS)).minLength(1).maxLength(28),
  })
)
