import vine from '@vinejs/vine'

export const matchBackfillValidator = vine.compile(
  vine.object({
    valorantMatchId: vine.string().trim().minLength(1),
    scheduledAt: vine.string().trim().minLength(1),
    map: vine.string().trim().maxLength(255).optional(),
    scoreUs: vine.number().min(0),
    scoreThem: vine.number().min(0),
    result: vine.enum(['win', 'loss', 'draw']),
    matchType: vine.enum(['scrim', 'official', 'prac', 'playoffs']),
    opponentName: vine.string().trim().minLength(1).maxLength(255).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)
