import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'match_notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('match_id').unsigned().references('id').inTable('matches').onDelete('CASCADE')
      table.string('notification_type').notNullable() // '24h' | '1h'
      table.timestamp('sent_at').notNullable()
      table.unique(['match_id', 'notification_type'])
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
