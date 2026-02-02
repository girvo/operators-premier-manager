import vine from '@vinejs/vine'

export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    timezone: vine.string().trim().minLength(1),
    trackerggUsername: vine.string().trim().maxLength(255).optional(),
  })
)
