import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'match_player_agents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('kills').nullable()
      table.integer('deaths').nullable()
      table.integer('assists').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('kills')
      table.dropColumn('deaths')
      table.dropColumn('assists')
    })
  }
}
