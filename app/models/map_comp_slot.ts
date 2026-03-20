import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Map from '#models/map'

export default class MapCompSlot extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare mapId: number

  @column()
  declare agentKey: string

  @column()
  declare slotOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Map)
  declare map: BelongsTo<typeof Map>
}
