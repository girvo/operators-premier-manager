import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('discord_id').unique().nullable()
      table.string('discord_username').nullable()
      table.string('discord_avatar_url').nullable()
      table.string('approval_status').defaultTo('approved').notNullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('discord_id')
      table.dropColumn('discord_username')
      table.dropColumn('discord_avatar_url')
      table.dropColumn('approval_status')
    })
  }
}
