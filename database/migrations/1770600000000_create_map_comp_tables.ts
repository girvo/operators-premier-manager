import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('map_comp_slots', (table) => {
      table.increments('id')
      table.integer('map_id').unsigned().references('id').inTable('maps').onDelete('CASCADE')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('agent_key').notNullable()
      table.integer('slot_order').defaultTo(0)

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['map_id', 'user_id'])
      table.unique(['map_id', 'agent_key'])
    })

    this.schema.createTable('map_comp_suggestions', (table) => {
      table.increments('id')
      table.integer('map_id').unsigned().references('id').inTable('maps').onDelete('CASCADE')
      table.integer('suggested_by').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('status').notNullable().defaultTo('pending')
      table.text('note').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable('map_comp_suggestion_slots', (table) => {
      table.increments('id')
      table
        .integer('suggestion_id')
        .unsigned()
        .references('id')
        .inTable('map_comp_suggestions')
        .onDelete('CASCADE')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('agent_key').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable('map_comp_suggestion_slots')
    this.schema.dropTable('map_comp_suggestions')
    this.schema.dropTable('map_comp_slots')
  }
}
