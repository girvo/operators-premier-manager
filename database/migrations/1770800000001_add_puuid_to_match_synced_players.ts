import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'match_synced_players'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('puuid').nullable()
      table.index('puuid')
    })

    // For Premier matches Henrik returns empty riot_id values, so the old
    // (match_id, riot_id) unique constraint collapses every player onto the
    // same key. Switch to (match_id, puuid) which is always populated.
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['match_id', 'riot_id'])
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['match_id', 'puuid'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['match_id', 'puuid'])
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['match_id', 'riot_id'])
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex('puuid')
      table.dropColumn('puuid')
    })
  }
}
