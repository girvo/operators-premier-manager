import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.from('matches').where('opponent_name', 'null').update({ opponent_name: null })
    })
  }

  async down() {
    // No reversible action for data cleanup usually, or we could potentially try to reverse it but "null" string is invalid state anyway.
  }
}
