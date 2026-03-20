import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import { AGENTS } from '#constants/agents'

export default class SeedTestPlayers extends BaseCommand {
  static commandName = 'seed:test-players'
  static description =
    'Create fake roster players with random agent pools for local testing (non-production only)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({ description: 'Number of players to create', default: 5 })
  declare count: number

  async run() {
    if (app.inProduction) {
      this.logger.error('This command cannot be run in production')
      return
    }

    const firstNames = [
      'Alex',
      'Jordan',
      'Sam',
      'Riley',
      'Casey',
      'Morgan',
      'Taylor',
      'Quinn',
      'Avery',
      'Drew',
    ]
    const lastNames = [
      'Chen',
      'Park',
      'Silva',
      'Nguyen',
      'Kim',
      'Patel',
      'Lopez',
      'Sato',
      'Müller',
      'Andersen',
    ]

    const created: User[] = []

    for (let i = 0; i < this.count; i++) {
      const first = firstNames[Math.floor(Math.random() * firstNames.length)]
      const last = lastNames[Math.floor(Math.random() * lastNames.length)]
      const fullName = `${first} ${last}`
      const email = `${first.toLowerCase()}.${last.toLowerCase()}.${Date.now()}@test.local`

      // Pick 4-8 random agents
      const shuffled = [...AGENTS].sort(() => Math.random() - 0.5)
      const agentCount = 4 + Math.floor(Math.random() * 5)
      const agentPrefs = shuffled.slice(0, agentCount).map((a) => a.key)

      const user = await User.create({
        fullName,
        email,
        password: 'test',
        role: 'player',
        timezone: 'America/Los_Angeles',
        isOnRoster: true,
        approvalStatus: 'approved',
        needsOnboarding: false,
        logoFilename: null,
        trackerggUsername: null,
        discordId: null,
        discordUsername: null,
        discordAvatarUrl: null,
        agentPrefs,
      })

      created.push(user)
    }

    this.logger.success(`Created ${created.length} test player(s):`)
    for (const user of created) {
      this.logger.info(
        `  ${user.fullName} (${user.email}) — ${user.agentPrefs.length} agents: ${user.agentPrefs.join(', ')}`
      )
    }
    this.logger.info('Password for all: test')
  }
}
