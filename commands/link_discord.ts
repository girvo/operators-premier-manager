import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'

export default class LinkDiscord extends BaseCommand {
  static commandName = 'link:discord'
  static description = 'Link a Discord ID to an existing user account'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Email of the user to link' })
  declare email: string

  @args.string({ description: 'Discord user ID to link' })
  declare discordId: string

  async run() {
    const user = await User.findBy('email', this.email)

    if (!user) {
      this.logger.error(`User not found with email: ${this.email}`)
      return
    }

    const existingUser = await User.findBy('discordId', this.discordId)
    if (existingUser && existingUser.id !== user.id) {
      this.logger.error(
        `Discord ID ${this.discordId} is already linked to another user: ${existingUser.email}`
      )
      return
    }

    user.discordId = this.discordId
    await user.save()

    this.logger.success(`Discord ID ${this.discordId} linked to ${user.email}`)
  }
}
