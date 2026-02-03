import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'matches'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('score_us').nullable()
      table.integer('score_them').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('score_us')
      table.dropColumn('score_them')
    })
  }
}
