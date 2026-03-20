import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('map_comp_slots', (table) => {
      table.dropUnique(['map_id', 'user_id'])
      table.dropForeign('user_id')
      table.dropColumn('user_id')
    })

    this.schema.alterTable('map_comp_suggestion_slots', (table) => {
      table.dropForeign('user_id')
      table.dropColumn('user_id')
      table.integer('slot_order').defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('map_comp_slots', (table) => {
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.unique(['map_id', 'user_id'])
    })

    this.schema.alterTable('map_comp_suggestion_slots', (table) => {
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.dropColumn('slot_order')
    })
  }
}
