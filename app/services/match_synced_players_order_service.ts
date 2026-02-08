import MatchSyncedPlayer from '#models/match_synced_player'
import User from '#models/user'
import ValorantApiService from '#services/valorant_api_service'

type TeamSide = 'Red' | 'Blue'

export default class MatchSyncedPlayersOrderService {
  static async getKnownRiotIds(): Promise<Set<string>> {
    const users = await User.query().whereNotNull('trackerggUsername')
    const riotIds = new Set<string>()

    for (const user of users) {
      const parsed = ValorantApiService.parseRiotId(user.trackerggUsername || '')
      if (!parsed) continue
      riotIds.add(`${parsed.name}#${parsed.tag}`.toLowerCase())
    }

    return riotIds
  }

  static determineOurTeam(
    syncedPlayers: MatchSyncedPlayer[],
    knownRiotIds: Set<string>
  ): TeamSide | null {
    let redCount = 0
    let blueCount = 0
    let firstKnownTeam: TeamSide | null = null

    for (const player of syncedPlayers) {
      if (!knownRiotIds.has(player.riotId)) continue
      if (player.team !== 'Red' && player.team !== 'Blue') continue

      if (!firstKnownTeam) {
        firstKnownTeam = player.team
      }

      if (player.team === 'Red') redCount++
      if (player.team === 'Blue') blueCount++
    }

    if (redCount === 0 && blueCount === 0) return null
    if (redCount > blueCount) return 'Red'
    if (blueCount > redCount) return 'Blue'
    return firstKnownTeam
  }

  static sortPlayers(syncedPlayers: MatchSyncedPlayer[], ourTeam: TeamSide | null) {
    return [...syncedPlayers].sort((a, b) => {
      const teamRankDiff = this.getTeamRank(a.team, ourTeam) - this.getTeamRank(b.team, ourTeam)
      if (teamRankDiff !== 0) return teamRankDiff

      const scoreA = a.score ?? -1
      const scoreB = b.score ?? -1
      if (scoreA !== scoreB) return scoreB - scoreA

      const killsA = a.kills ?? -1
      const killsB = b.kills ?? -1
      if (killsA !== killsB) return killsB - killsA

      return a.playerName.localeCompare(b.playerName)
    })
  }

  private static getTeamRank(team: string | null, ourTeam: TeamSide | null): number {
    if (ourTeam === 'Red') {
      if (team === 'Red') return 0
      if (team === 'Blue') return 1
      return 2
    }

    if (ourTeam === 'Blue') {
      if (team === 'Blue') return 0
      if (team === 'Red') return 1
      return 2
    }

    if (team === 'Red') return 0
    if (team === 'Blue') return 1
    return 2
  }
}
