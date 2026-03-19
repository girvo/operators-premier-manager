import vine from '@vinejs/vine'

export const bulkDeleteMatchesValidator = vine.compile(
  vine.object({
    matchIds: vine.array(vine.number()).minLength(1),
  })
)
