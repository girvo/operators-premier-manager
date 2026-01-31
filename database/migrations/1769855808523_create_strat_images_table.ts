import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'strat_images'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('strat_book_id')
        .unsigned()
        .references('id')
        .inTable('strat_books')
        .onDelete('CASCADE')
      table.string('filename').notNullable()
      table.string('original_name').notNullable()
      table.integer('sort_order').defaultTo(0)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
