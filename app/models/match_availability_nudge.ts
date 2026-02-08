import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Match from '#models/match'
import User from '#models/user'

export default class MatchAvailabilityNudge extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare matchId: number

  @column()
  declare userId: number

  @column()
  declare adminUserId: number

  @column()
  declare status: 'sent' | 'blocked' | 'failed'

  @column()
  declare forced: boolean

  @column()
  declare errorCode: string | null

  @column()
  declare errorMessage: string | null

  @column.dateTime()
  declare sentAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Match)
  declare match: BelongsTo<typeof Match>

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'adminUserId' })
  declare adminUser: BelongsTo<typeof User>
}
