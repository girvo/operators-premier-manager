import { DateTime } from 'luxon'
import Match from '#models/match'
import Map from '#models/map'
import User from '#models/user'

type UserOverrides = Partial<User>

export const createUser = async (overrides: UserOverrides = {}) => {
  const password = overrides.password ?? 'password'

  return User.create({
    fullName: 'Test User',
    email: `user_${Date.now()}@example.com`,
    password,
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
    agentPrefs: [],
    ...overrides,
  })
}

export const createAdminUser = async (overrides: UserOverrides = {}) => {
  return createUser({
    role: 'admin',
    ...overrides,
  })
}

export const createMap = async (overrides: Partial<Map> = {}) => {
  return Map.create({
    name: 'Ascent',
    slug: `ascent-${Date.now()}`,
    isActive: true,
    ...overrides,
  })
}

export const createMatch = async (overrides: Partial<Match> = {}) => {
  return Match.create({
    scheduledAt: DateTime.now().plus({ days: 1 }),
    opponentName: 'Test Opponent',
    map: 'Ascent',
    matchType: 'scrim',
    result: null,
    scoreUs: null,
    scoreThem: null,
    notes: null,
    ...overrides,
  })
}
