import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import MatchAvailability from '#models/match_availability'

export default class Match extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column.dateTime()
  declare scheduledAt: DateTime

  @column()
  declare opponentName: string

  @column()
  declare map: string | null

  @column()
  declare matchType: 'scrim' | 'official'

  @column()
  declare result: 'win' | 'loss' | 'draw' | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => MatchAvailability)
  declare availabilities: HasMany<typeof MatchAvailability>
}
