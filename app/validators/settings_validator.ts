import vine from '@vinejs/vine'
import { AGENT_KEYS } from '#constants/agents'

export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    timezone: vine.string().trim().minLength(1),
    trackerggUsername: vine.string().trim().maxLength(255).optional(),
    agents: vine.array(vine.enum(AGENT_KEYS)).minLength(1).maxLength(28),
  })
)
