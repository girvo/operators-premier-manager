import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Map from '#models/map'
import User from '#models/user'
import MapCompSuggestionSlot from '#models/map_comp_suggestion_slot'

export default class MapCompSuggestion extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare mapId: number

  @column()
  declare suggestedBy: number

  @column()
  declare status: 'pending' | 'accepted' | 'rejected'

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Map)
  declare map: BelongsTo<typeof Map>

  @belongsTo(() => User, { foreignKey: 'suggestedBy' })
  declare suggestor: BelongsTo<typeof User>

  @hasMany(() => MapCompSuggestionSlot, { foreignKey: 'suggestionId' })
  declare slots: HasMany<typeof MapCompSuggestionSlot>
}
