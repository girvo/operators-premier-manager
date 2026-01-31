import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Match from '#models/match'
import User from '#models/user'

export default class MatchAvailability extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare matchId: number

  @column()
  declare userId: number

  @column()
  declare status: 'yes' | 'no' | 'maybe' | 'pending'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Match)
  declare match: BelongsTo<typeof Match>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
