import vine from '@vinejs/vine'

export const updateCompValidator = vine.compile(
  vine.object({
    agents: vine.array(vine.string()).fixedLength(5),
  })
)

export const storeSuggestionValidator = vine.compile(
  vine.object({
    note: vine.string().maxLength(500).optional(),
    agents: vine.array(vine.string()).fixedLength(5),
  })
)
