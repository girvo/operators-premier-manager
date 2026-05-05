import vine from '@vinejs/vine'

export const bulkScheduleValidator = vine.compile(
  vine.object({
    startDate: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    maps: vine.array(vine.string().minLength(1).maxLength(255)).minLength(1).maxLength(7),
  })
)
