import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'weekly_availabilities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('day_of_week').notNullable() // 0=Sun, 1=Mon, ..., 6=Sat
      table.integer('hour').notNullable() // 0-23 in UTC
      table.boolean('is_available').defaultTo(false)

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['user_id', 'day_of_week', 'hour'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
