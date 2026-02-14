import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import PlayerNudge from '#models/player_nudge'
import MatchAvailabilityNudge from '#models/match_availability_nudge'

export default class ClearNudgeCooldown extends BaseCommand {
  static commandName = 'nudge:clear-cooldown'
  static description = 'Clear all nudge cooldowns for a user so they can be nudged again immediately'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Email of the user to clear cooldowns for' })
  declare email: string

  async run() {
    const user = await User.findBy('email', this.email)

    if (!user) {
      this.logger.error(`User not found with email: ${this.email}`)
      return
    }

    const playerNudgesDeleted = await PlayerNudge.query()
      .where('userId', user.id)
      .where('status', 'sent')
      .delete()

    const matchNudgesDeleted = await MatchAvailabilityNudge.query()
      .where('userId', user.id)
      .where('status', 'sent')
      .delete()

    const playerCount = playerNudgesDeleted[0] ?? 0
    const matchCount = matchNudgesDeleted[0] ?? 0

    if (playerCount === 0 && matchCount === 0) {
      this.logger.info(`No active nudge cooldowns found for ${this.email}`)
    } else {
      this.logger.success(
        `Cleared cooldowns for ${this.email}: ${playerCount} player data nudge(s), ${matchCount} match availability nudge(s)`
      )
    }
  }
}
