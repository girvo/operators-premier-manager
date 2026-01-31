import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('role').defaultTo('player').notNullable()
      table.string('timezone').defaultTo('Australia/Sydney').notNullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
      table.dropColumn('timezone')
    })
  }
}
