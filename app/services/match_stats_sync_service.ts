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
    const puuidToUserId = new Map<string, number>()

    for (const player of rosterPlayers) {
      const parsed = ValorantApiService.parseRiotId(player.trackerggUsername || '')
      if (parsed) {
        const riotIdKey = `${parsed.name}#${parsed.tag}`.toLowerCase()
        riotIdToUserId.set(riotIdKey, player.id)
      }
      if (player.puuid) {
        puuidToUserId.set(player.puuid, player.id)
      }
    }

    // Map each snapshot entry to a user (puuid first since it's stable across
    // Premier matches, then riot id as a fallback for non-Premier).
    // When we match by riot id and the user has no stored puuid, learn it.
    const resolveUserId = async (entry: (typeof syncedPlayers)[number]): Promise<number | null> => {
      if (entry.puuid) {
        const byPuuid = puuidToUserId.get(entry.puuid)
        if (byPuuid) return byPuuid
      }
      if (entry.riotId) {
        const byRiotId = riotIdToUserId.get(entry.riotId)
        if (byRiotId) {
          if (entry.puuid) {
            const user = rosterPlayers.find((u) => u.id === byRiotId)
            if (user && !user.puuid) {
              user.puuid = entry.puuid
              await user.save()
              puuidToUserId.set(entry.puuid, user.id)
            }
          }
          return byRiotId
        }
      }
      return null
    }

    const rosterAgentRecords: Array<{
      matchId: number
      userId: number
      agentKey: string
      kills: number | null
      deaths: number | null
      assists: number | null
    }> = []
    for (const entry of syncedPlayers) {
      const userId = await resolveUserId(entry)
      if (!userId || !entry.agentKey) continue
      rosterAgentRecords.push({
        matchId: match.id,
        userId,
        agentKey: entry.agentKey,
        kills: entry.kills,
        deaths: entry.deaths,
        assists: entry.assists,
      })
    }

    const syncedPlayerRecords = syncedPlayers
      .filter((entry) => Boolean(entry.puuid))
      .map((entry) => {
        // Premier matches return empty names from Henrik — backfill from the
        // matched roster user so the display isn't a row of agent names with
        // no player identity. Opponent rows stay anonymous (we have no record).
        let playerName = entry.playerName
        let playerTag = entry.playerTag
        if (!playerName && entry.puuid) {
          const userId = puuidToUserId.get(entry.puuid)
          if (userId) {
            const user = rosterPlayers.find((u) => u.id === userId)
            if (user) {
              const parsed = ValorantApiService.parseRiotId(user.trackerggUsername || '')
              if (parsed) {
                playerName = parsed.name
                playerTag = parsed.tag
              } else if (user.fullName) {
                playerName = user.fullName
              }
            }
          }
        }

        return {
          matchId: match.id,
          riotId: entry.riotId,
          puuid: entry.puuid,
          playerName,
          playerTag,
          team: entry.team,
          agentKey: entry.agentKey,
          kills: entry.kills,
          deaths: entry.deaths,
          assists: entry.assists,
          score: entry.score,
          headshots: entry.headshots,
          bodyshots: entry.bodyshots,
          legshots: entry.legshots,
        }
      })

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
