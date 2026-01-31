import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'matches'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.datetime('scheduled_at').notNullable()
      table.string('opponent_name').notNullable()
      table.string('map').nullable()
      table.string('match_type').notNullable().defaultTo('scrim') // 'scrim' or 'official'
      table.string('result').nullable() // 'win', 'loss', 'draw', or null
      table.text('notes').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
