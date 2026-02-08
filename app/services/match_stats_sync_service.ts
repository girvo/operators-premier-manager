import Match from '#models/match'
import MatchPlayerAgent from '#models/match_player_agent'
import MatchSyncedPlayer from '#models/match_synced_player'
import User from '#models/user'
import ValorantApiService from '#services/valorant_api_service'

export default class MatchStatsSyncService {
  static async syncFromValorantMatchId(match: Match, valorantMatchId?: string) {
    const targetMatchId = valorantMatchId || match.valorantMatchId

    if (!targetMatchId) {
      throw new Error(`Match #${match.id} does not have a stored Valorant match id`)
    }

    const snapshot = await ValorantApiService.getMatchStatsSnapshot(targetMatchId)
    const syncedPlayers = snapshot.players
    const rosterPlayers = await User.query().whereNotNull('trackerggUsername')
    const riotIdToUserId = new Map<string, number>()

    for (const player of rosterPlayers) {
      const parsed = ValorantApiService.parseRiotId(player.trackerggUsername || '')
      if (!parsed) continue
      const riotIdKey = `${parsed.name}#${parsed.tag}`.toLowerCase()
      riotIdToUserId.set(riotIdKey, player.id)
    }

    const rosterAgentRecords = syncedPlayers
      .map((entry) => {
        const userId = riotIdToUserId.get(entry.riotId)
        if (!userId) return null
        if (!entry.agentKey) return null
        return {
          matchId: match.id,
          userId,
          agentKey: entry.agentKey,
          kills: entry.kills,
          deaths: entry.deaths,
          assists: entry.assists,
        }
      })
      .filter(
        (
          record
        ): record is {
          matchId: number
          userId: number
          agentKey: string
          kills: number | null
          deaths: number | null
          assists: number | null
        } => Boolean(record && record.userId && record.agentKey)
      )

    const syncedPlayerRecords = syncedPlayers.map((entry) => ({
      matchId: match.id,
      riotId: entry.riotId,
      playerName: entry.playerName,
      playerTag: entry.playerTag,
      team: entry.team,
      agentKey: entry.agentKey,
      kills: entry.kills,
      deaths: entry.deaths,
      assists: entry.assists,
      score: entry.score,
      headshots: entry.headshots,
      bodyshots: entry.bodyshots,
      legshots: entry.legshots,
    }))

    await MatchPlayerAgent.query().where('matchId', match.id).delete()
    await MatchSyncedPlayer.query().where('matchId', match.id).delete()

    if (rosterAgentRecords.length > 0) {
      await MatchPlayerAgent.createMany(rosterAgentRecords)
    }

    if (syncedPlayerRecords.length > 0) {
      await MatchSyncedPlayer.createMany(syncedPlayerRecords)
    }

    if (snapshot.map) {
      match.valorantMap = snapshot.map
      await match.save()
    }

    return {
      rosterAgentRows: rosterAgentRecords.length,
      syncedPlayersRows: syncedPlayerRecords.length,
    }
  }
}
