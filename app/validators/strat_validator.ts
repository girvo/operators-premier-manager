import vine from '@vinejs/vine'

export const createStratValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(1).maxLength(255),
    description: vine.string().maxLength(2000).optional(),
    valoplantUrl: vine.string().url().maxLength(500).optional(),
  })
)

export const updateStratValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(1).maxLength(255),
    description: vine.string().maxLength(2000).optional(),
    valoplantUrl: vine.string().url().maxLength(500).optional(),
  })
)
