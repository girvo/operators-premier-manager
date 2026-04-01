import vine from '@vinejs/vine'

export const bulkScheduleValidator = vine.compile(
  vine.object({
    maps: vine.array(vine.string().minLength(1).maxLength(255)).minLength(1).maxLength(7),
  })
)
