import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'

export default class AdminSeeder extends BaseSeeder {
  async run() {
    await User.updateOrCreate(
      { email: 'admin@example.com' },
      {
        fullName: 'Girvo',
        email: 'admin@example.com',
        password: 'NOTAREALPASSWORD',
        role: 'admin',
        timezone: 'Australia/Brisbane',
      }
    )
  }
}
