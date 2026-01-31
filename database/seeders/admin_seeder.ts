import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'

export default class AdminSeeder extends BaseSeeder {
  async run() {
    await User.updateOrCreate(
      { email: 'admin@operators.gg' },
      {
        fullName: 'Admin',
        email: 'admin@operators.gg',
        password: 'password',
        role: 'admin',
        timezone: 'Australia/Sydney',
      }
    )
  }
}
