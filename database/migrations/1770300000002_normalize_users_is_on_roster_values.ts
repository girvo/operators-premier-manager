import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.defer(async (db) => {
      await db
        .from(this.tableName)
        .whereRaw("lower(trim(cast(is_on_roster as text))) in ('true', 'on', 'yes')")
        .update({ is_on_roster: 1 })

      await db
        .from(this.tableName)
        .whereRaw("lower(trim(cast(is_on_roster as text))) in ('false', 'off', 'no', '')")
        .update({ is_on_roster: 0 })
    })
  }

  async down() {
    // Data normalization migration is intentionally irreversible.
  }
}
