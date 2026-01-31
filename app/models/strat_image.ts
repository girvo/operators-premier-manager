import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import StratBook from '#models/strat_book'

export default class StratImage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare stratBookId: number

  @column()
  declare filename: string

  @column()
  declare originalName: string

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => StratBook)
  declare stratBook: BelongsTo<typeof StratBook>
}
