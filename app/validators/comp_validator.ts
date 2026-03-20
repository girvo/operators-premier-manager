import vine from '@vinejs/vine'

export const updateCompValidator = vine.compile(
  vine.object({
    slots: vine
      .array(
        vine.object({
          userId: vine.number(),
          agentKey: vine.string(),
        })
      )
      .fixedLength(5),
  })
)

export const storeSuggestionValidator = vine.compile(
  vine.object({
    note: vine.string().maxLength(500).optional(),
    slots: vine
      .array(
        vine.object({
          userId: vine.number(),
          agentKey: vine.string(),
        })
      )
      .fixedLength(5),
  })
)
