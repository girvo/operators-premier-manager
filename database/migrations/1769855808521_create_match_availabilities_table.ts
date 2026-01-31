import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'match_availabilities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('match_id').unsigned().references('id').inTable('matches').onDelete('CASCADE')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('status').notNullable().defaultTo('pending') // 'yes', 'no', 'maybe', 'pending'

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['match_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
