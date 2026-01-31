import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'strat_books'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('map_id').unsigned().references('id').inTable('maps').onDelete('CASCADE')
      table.string('title').notNullable()
      table.text('description').nullable()
      table.string('valoplant_url').nullable()
      table.integer('sort_order').defaultTo(0)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
