import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import MatchAvailability from '#models/match_availability'
import MatchPlayerAgent from '#models/match_player_agent'
import MatchNotification from '#models/match_notification'

export default class Match extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column.dateTime()
  declare scheduledAt: DateTime

  @column()
  declare opponentName: string | null

  @column()
  declare map: string | null

  @column()
  declare matchType: 'scrim' | 'official'

  @column()
  declare result: 'win' | 'loss' | 'draw' | null

  @column()
  declare scoreUs: number | null

  @column()
  declare scoreThem: number | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => MatchAvailability)
  declare availabilities: HasMany<typeof MatchAvailability>

  @hasMany(() => MatchPlayerAgent)
  declare playerAgents: HasMany<typeof MatchPlayerAgent>

  @hasMany(() => MatchNotification)
  declare notifications: HasMany<typeof MatchNotification>
}
