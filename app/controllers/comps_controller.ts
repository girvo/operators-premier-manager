import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Map from '#models/map'
import MapCompSlot from '#models/map_comp_slot'
import MapCompSuggestion from '#models/map_comp_suggestion'
import MapCompSuggestionSlot from '#models/map_comp_suggestion_slot'
import User from '#models/user'
import { AGENT_LOOKUP } from '#constants/agents'
import { updateCompValidator, storeSuggestionValidator } from '#validators/comp_validator'

export default class CompsController {
  async edit({ params, view }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()

    const slots = await MapCompSlot.query()
      .where('mapId', map.id)
      .preload('user')
      .orderBy('slotOrder', 'asc')

    const rosterPlayers = await User.query()
      .where('isOnRoster', true)
      .orderBy('fullName', 'asc')

    // Pre-compute slot data with agent options for each existing slot
    const slotData = Array.from({ length: 5 }, (_, i) => {
      const existing = slots[i] || null
      const player = existing
        ? rosterPlayers.find((p) => p.id === existing.userId)
        : null
      const agentOptions = player
        ? player.agentPrefs.map((key) => AGENT_LOOKUP[key]).filter(Boolean)
        : []
      return { existing, agentOptions }
    })

    return view.render('pages/strats/comp_edit', {
      map,
      slotData,
      rosterPlayers,
      agentLookup: AGENT_LOOKUP,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const data = await request.validateUsing(updateCompValidator)

    const rosterPlayers = await User.query().where('isOnRoster', true)
    const rosterIds = new Set(rosterPlayers.map((p) => p.id))

    const userIds = data.slots.map((s) => s.userId)
    const agentKeys = data.slots.map((s) => s.agentKey)

    // Validate no duplicate players
    if (new Set(userIds).size !== userIds.length) {
      session.flash('error', 'Each player can only appear once in the comp')
      return response.redirect(`/strats/${params.mapSlug}/comp/edit`)
    }

    // Validate no duplicate agents
    if (new Set(agentKeys).size !== agentKeys.length) {
      session.flash('error', 'Each agent can only appear once in the comp')
      return response.redirect(`/strats/${params.mapSlug}/comp/edit`)
    }

    // Validate all players are on roster
    for (const userId of userIds) {
      if (!rosterIds.has(userId)) {
        session.flash('error', 'All players must be on the roster')
        return response.redirect(`/strats/${params.mapSlug}/comp/edit`)
      }
    }

    // Validate agent keys are valid and in player prefs
    const playerMap = new globalThis.Map(rosterPlayers.map((p) => [p.id, p]))
    for (const slot of data.slots) {
      if (!AGENT_LOOKUP[slot.agentKey]) {
        session.flash('error', `Invalid agent: ${slot.agentKey}`)
        return response.redirect(`/strats/${params.mapSlug}/comp/edit`)
      }
      const player = playerMap.get(slot.userId)
      if (player && !player.agentPrefs.includes(slot.agentKey)) {
        session.flash(
          'error',
          `${player.fullName ?? player.email} cannot play ${AGENT_LOOKUP[slot.agentKey].name}`
        )
        return response.redirect(`/strats/${params.mapSlug}/comp/edit`)
      }
    }

    await db.transaction(async (trx) => {
      await MapCompSlot.query({ client: trx }).where('mapId', map.id).delete()

      for (let i = 0; i < data.slots.length; i++) {
        await MapCompSlot.create(
          {
            mapId: map.id,
            userId: data.slots[i].userId,
            agentKey: data.slots[i].agentKey,
            slotOrder: i + 1,
          },
          { client: trx }
        )
      }
    })

    session.flash('success', 'Comp updated successfully')
    return response.redirect(`/strats/${params.mapSlug}`)
  }

  async suggest({ params, view, response }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()

    const slots = await MapCompSlot.query()
      .where('mapId', map.id)
      .preload('user')
      .orderBy('slotOrder', 'asc')

    if (slots.length === 0) {
      return response.redirect(`/strats/${params.mapSlug}`)
    }

    // Build agent options for each player in the comp
    const playerAgentOptions = slots.map((slot) => {
      const playerAgents = slot.user.agentPrefs
        .map((key) => AGENT_LOOKUP[key])
        .filter(Boolean)
      return {
        slot,
        agents: playerAgents,
      }
    })

    return view.render('pages/strats/comp_suggest', {
      map,
      slots,
      playerAgentOptions,
      agentLookup: AGENT_LOOKUP,
    })
  }

  async storeSuggestion({ params, request, response, session, auth }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const data = await request.validateUsing(storeSuggestionValidator)

    const currentSlots = await MapCompSlot.query()
      .where('mapId', map.id)
      .orderBy('slotOrder', 'asc')

    if (currentSlots.length === 0) {
      session.flash('error', 'No comp exists to suggest changes for')
      return response.redirect(`/strats/${params.mapSlug}`)
    }

    // Build a map of current comp: userId -> agentKey
    const currentAgents = new globalThis.Map(currentSlots.map((s) => [s.userId, s.agentKey]))

    // Find changed slots
    const changes = data.slots.filter((submitted) => {
      const currentAgent = currentAgents.get(submitted.userId)
      return currentAgent !== submitted.agentKey
    })

    if (changes.length === 0) {
      session.flash('error', 'No changes detected')
      return response.redirect(`/strats/${params.mapSlug}`)
    }

    // Validate the resulting comp would be valid (no duplicate agents)
    const resultingAgents = new globalThis.Map(currentSlots.map((s) => [s.userId, s.agentKey]))
    for (const change of changes) {
      resultingAgents.set(change.userId, change.agentKey)
    }
    const agentValues = [...resultingAgents.values()]
    if (new Set(agentValues).size !== agentValues.length) {
      session.flash('error', 'The suggested changes would result in duplicate agents')
      return response.redirect(`/strats/${params.mapSlug}/comp/suggest`)
    }

    // Validate agent keys are valid and in player prefs
    const playerIds = changes.map((c) => c.userId)
    const players = await User.query().whereIn('id', playerIds)
    const playerMap = new globalThis.Map(players.map((p) => [p.id, p]))

    for (const change of changes) {
      if (!AGENT_LOOKUP[change.agentKey]) {
        session.flash('error', `Invalid agent: ${change.agentKey}`)
        return response.redirect(`/strats/${params.mapSlug}/comp/suggest`)
      }
      const player = playerMap.get(change.userId)
      if (player && !player.agentPrefs.includes(change.agentKey)) {
        session.flash(
          'error',
          `${player.fullName ?? player.email} cannot play ${AGENT_LOOKUP[change.agentKey].name}`
        )
        return response.redirect(`/strats/${params.mapSlug}/comp/suggest`)
      }
    }

    await db.transaction(async (trx) => {
      const suggestion = await MapCompSuggestion.create(
        {
          mapId: map.id,
          suggestedBy: auth.user!.id,
          status: 'pending',
          note: data.note || null,
        },
        { client: trx }
      )

      for (const change of changes) {
        await MapCompSuggestionSlot.create(
          {
            suggestionId: suggestion.id,
            userId: change.userId,
            agentKey: change.agentKey,
          },
          { client: trx }
        )
      }
    })

    session.flash('success', 'Suggestion submitted')
    return response.redirect(`/strats/${params.mapSlug}`)
  }

  async acceptSuggestion({ params, request, response, session }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const suggestion = await MapCompSuggestion.query()
      .where('id', params.id)
      .where('mapId', map.id)
      .where('status', 'pending')
      .preload('slots')
      .firstOrFail()

    await db.transaction(async (trx) => {
      // Apply each slot change to the comp
      for (const slot of suggestion.slots) {
        await MapCompSlot.query({ client: trx })
          .where('mapId', map.id)
          .where('userId', slot.userId)
          .update({ agentKey: slot.agentKey })
      }

      suggestion.status = 'accepted'
      suggestion.useTransaction(trx)
      await suggestion.save()
    })

    session.flash('success', 'Suggestion accepted and applied')

    if (request.header('HX-Request')) {
      response.header('HX-Redirect', `/strats/${params.mapSlug}`)
      return response.send('')
    }

    return response.redirect(`/strats/${params.mapSlug}`)
  }

  async rejectSuggestion({ params, request, response, session }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const suggestion = await MapCompSuggestion.query()
      .where('id', params.id)
      .where('mapId', map.id)
      .where('status', 'pending')
      .firstOrFail()

    suggestion.status = 'rejected'
    await suggestion.save()

    if (request.header('HX-Request')) {
      return response.send('')
    }

    session.flash('success', 'Suggestion rejected')
    return response.redirect(`/strats/${params.mapSlug}`)
  }

  async playerAgents({ params, request, view }: HttpContext) {
    const userId = request.input('userId', params.userId)
    const user = await User.findOrFail(userId)

    const agents = user.agentPrefs.map((key) => AGENT_LOOKUP[key]).filter(Boolean)

    return view.render('partials/comp_player_agents', { agents })
  }
}
