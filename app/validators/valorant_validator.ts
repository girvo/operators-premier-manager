import vine from '@vinejs/vine'

export const valorantScoreValidator = vine.compile(
  vine.object({
    scoreUs: vine.number().min(0),
    scoreThem: vine.number().min(0),
    result: vine.enum(['win', 'loss', 'draw']),
  })
)
