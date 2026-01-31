import vine from '@vinejs/vine'

export const createPlayerValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(1).maxLength(255),
    email: vine.string().email().maxLength(254),
    password: vine.string().minLength(8),
    role: vine.enum(['admin', 'player']),
    timezone: vine.string().minLength(1),
  })
)

export const updatePlayerValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(1).maxLength(255),
    email: vine.string().email().maxLength(254),
    password: vine.string().minLength(8).optional(),
    role: vine.enum(['admin', 'player']),
    timezone: vine.string().minLength(1),
  })
)
