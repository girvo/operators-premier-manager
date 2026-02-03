import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare role: 'admin' | 'player'

  @column()
  declare timezone: string

  @column()
  declare logoFilename: string | null

  @column()
  declare trackerggUsername: string | null

  @column()
  declare isOnRoster: boolean

  @column()
  declare discordId: string | null

  @column()
  declare discordUsername: string | null

  @column()
  declare discordAvatarUrl: string | null

  @column()
  declare approvalStatus: 'approved' | 'pending' | 'rejected'

  @column()
  declare needsOnboarding: boolean

  @column({
    prepare: (value: string[] | null) => JSON.stringify(value ?? []),
    consume: (value: string | null) => {
      if (!value) return []
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    },
  })
  declare agentPrefs: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  get isAdmin(): boolean {
    return this.role === 'admin'
  }

  get isPending(): boolean {
    return this.approvalStatus === 'pending'
  }

  get isApproved(): boolean {
    return this.approvalStatus === 'approved'
  }

  get isRejected(): boolean {
    return this.approvalStatus === 'rejected'
  }

  get trackerggUrl(): string | null {
    if (!this.trackerggUsername) return null
    return `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(this.trackerggUsername)}`
  }

  get logoUrl(): string | null {
    if (!this.logoFilename) return null
    return `/uploads/players/${this.logoFilename}`
  }
}
