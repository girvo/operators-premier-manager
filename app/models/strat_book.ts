import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Map from '#models/map'
import StratImage from '#models/strat_image'

export default class StratBook extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare mapId: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare valoplantUrl: string | null

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Map)
  declare map: BelongsTo<typeof Map>

  @hasMany(() => StratImage)
  declare images: HasMany<typeof StratImage>
}
