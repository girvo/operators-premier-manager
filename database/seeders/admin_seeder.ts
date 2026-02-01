import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import env from '#start/env'

export default class AdminSeeder extends BaseSeeder {
  async run() {
    await User.updateOrCreate(
      { email: env.get('ADMIN_EMAIL') },
      {
        fullName: 'Girvo',
        email: env.get('ADMIN_EMAIL'),
        password: env.get('ADMIN_PASSWORD'),
        role: 'admin',
        timezone: 'Australia/Brisbane',
      }
    )
  }
}
