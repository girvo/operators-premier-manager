import vine from '@vinejs/vine'

export const createMatchValidator = vine.compile(
  vine.object({
    scheduledAt: vine.string(),
    opponentName: vine.string().minLength(1).maxLength(255).optional(),
    map: vine.string().maxLength(255).optional(),
    matchType: vine.enum(['scrim', 'official', 'prac']),
    notes: vine.string().maxLength(1000).optional(),
  })
)

export const updateMatchValidator = vine.compile(
  vine.object({
    scheduledAt: vine.string(),
    opponentName: vine.string().minLength(1).maxLength(255).optional(),
    map: vine.string().maxLength(255).optional(),
    matchType: vine.enum(['scrim', 'official', 'prac']),
    notes: vine.string().maxLength(1000).optional(),
  })
)
