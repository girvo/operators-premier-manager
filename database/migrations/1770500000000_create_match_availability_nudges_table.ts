import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'match_availability_nudges'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('match_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('matches')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('admin_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('status').notNullable() // sent | blocked | failed
      table.boolean('forced').notNullable().defaultTo(false)

      table.string('error_code').nullable()
      table.text('error_message').nullable()
      table.timestamp('sent_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['match_id', 'user_id', 'created_at'])
      table.index(['match_id', 'status', 'created_at'])
      table.index(['admin_user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
