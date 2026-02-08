import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Match from '#models/match'

export default class MatchSyncedPlayer extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare matchId: number

  @column()
  declare riotId: string

  @column()
  declare playerName: string

  @column()
  declare playerTag: string | null

  @column()
  declare team: 'Red' | 'Blue' | null

  @column()
  declare agentKey: string | null

  @column()
  declare kills: number | null

  @column()
  declare deaths: number | null

  @column()
  declare assists: number | null

  @column()
  declare score: number | null

  @column()
  declare headshots: number | null

  @column()
  declare bodyshots: number | null

  @column()
  declare legshots: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Match)
  declare match: BelongsTo<typeof Match>
}
