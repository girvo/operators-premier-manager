import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected matchesTable = 'matches'
  protected syncedPlayersTable = 'match_synced_players'

  async up() {
    this.schema.alterTable(this.matchesTable, (table) => {
      table.string('valorant_match_id').nullable()
    })

    this.schema.createTable(this.syncedPlayersTable, (table) => {
      table.increments('id')
      table
        .integer('match_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('matches')
        .onDelete('CASCADE')
      table.string('riot_id').notNullable()
      table.string('player_name').notNullable()
      table.string('player_tag').nullable()
      table.string('team').nullable()
      table.string('agent_key').nullable()
      table.integer('kills').nullable()
      table.integer('deaths').nullable()
      table.integer('assists').nullable()
      table.integer('score').nullable()
      table.integer('headshots').nullable()
      table.integer('bodyshots').nullable()
      table.integer('legshots').nullable()
      table.unique(['match_id', 'riot_id'])
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.syncedPlayersTable)

    this.schema.alterTable(this.matchesTable, (table) => {
      table.dropColumn('valorant_match_id')
    })
  }
}
