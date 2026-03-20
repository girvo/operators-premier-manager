import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MapCompSuggestion from '#models/map_comp_suggestion'
import User from '#models/user'

export default class MapCompSuggestionSlot extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare suggestionId: number

  @column()
  declare userId: number

  @column()
  declare agentKey: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => MapCompSuggestion, { foreignKey: 'suggestionId' })
  declare suggestion: BelongsTo<typeof MapCompSuggestion>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
