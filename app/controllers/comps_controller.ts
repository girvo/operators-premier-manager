import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Map from '#models/map'
import MapCompSlot from '#models/map_comp_slot'
import MapCompSuggestion from '#models/map_comp_suggestion'
import MapCompSuggestionSlot from '#models/map_comp_suggestion_slot'
import User from '#models/user'
import { AGENT_LOOKUP, AGENTS_BY_ROLE } from '#constants/agents'
import { updateCompValidator, storeSuggestionValidator } from '#validators/comp_validator'

export default class CompsController {
  async edit({ params, view }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()

    const rosterPlayers = await User.query().where('isOnRoster', true)
    const pool = new Set<string>()
    const agentPlayers: Record<string, string[]> = {}
    for (const player of rosterPlayers) {
      const name = player.fullName ?? player.email
      for (const key of player.agentPrefs) {
        pool.add(key)
        if (!agentPlayers[key]) agentPlayers[key] = []
        agentPlayers[key].push(name)
      }
    }

    const currentSlots = await MapCompSlot.query()
      .where('mapId', map.id)
      .orderBy('slotOrder', 'asc')
    const selectedAgents = currentSlots.map((s) => s.agentKey)

    const agentsByRole = AGENTS_BY_ROLE.map((group) => ({
      role: group.role,
      agents: [
        ...group.agents.filter((a) => pool.has(a.key)),
        ...group.agents.filter((a) => !pool.has(a.key)),
      ],
    }))

    return view.render('pages/strats/comp_edit', {
      map,
      agentsByRole,
      pool: [...pool],
      selectedAgents,
      agentPlayers,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const data = await request.validateUsing(updateCompValidator)

    const rosterPlayers = await User.query().where('isOnRoster', true)
    const pool = new Set<string>()
    for (const player of rosterPlayers) {
      for (const key of player.agentPrefs) {
        pool.add(key)
      }
    }

    // Validate no duplicate agents
    if (new Set(data.agents).size !== data.agents.length) {
      session.flash('error', 'Each agent can only appear once in the comp')
      return response.redirect(`/strats/${params.mapSlug}/comp/edit`)
    }

    // Validate all agents are valid and in pool
    for (const agentKey of data.agents) {
      if (!AGENT_LOOKUP[agentKey]) {
        session.flash('error', `Invalid agent: ${agentKey}`)
        return response.redirect(`/strats/${params.mapSlug}/comp/edit`)
      }
      if (!pool.has(agentKey)) {
        session.flash('error', `${AGENT_LOOKUP[agentKey].name} is not in the roster pool`)
        return response.redirect(`/strats/${params.mapSlug}/comp/edit`)
      }
    }

    await db.transaction(async (trx) => {
      await MapCompSlot.query({ client: trx }).where('mapId', map.id).delete()

      for (let i = 0; i < data.agents.length; i++) {
        await MapCompSlot.create(
          {
            mapId: map.id,
            agentKey: data.agents[i],
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

    const currentSlots = await MapCompSlot.query()
      .where('mapId', map.id)
      .orderBy('slotOrder', 'asc')

    if (currentSlots.length === 0) {
      return response.redirect(`/strats/${params.mapSlug}`)
    }

    const rosterPlayers = await User.query().where('isOnRoster', true)
    const pool = new Set<string>()
    const agentPlayers: Record<string, string[]> = {}
    for (const player of rosterPlayers) {
      const name = player.fullName ?? player.email
      for (const key of player.agentPrefs) {
        pool.add(key)
        if (!agentPlayers[key]) agentPlayers[key] = []
        agentPlayers[key].push(name)
      }
    }

    const selectedAgents = currentSlots.map((s) => s.agentKey)

    const agentsByRole = AGENTS_BY_ROLE.map((group) => ({
      role: group.role,
      agents: [
        ...group.agents.filter((a) => pool.has(a.key)),
        ...group.agents.filter((a) => !pool.has(a.key)),
      ],
    }))

    return view.render('pages/strats/comp_suggest', {
      map,
      agentsByRole,
      pool: [...pool],
      selectedAgents,
      agentPlayers,
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

    const currentAgentKeys = currentSlots.map((s) => s.agentKey)

    // Require at least one change
    const same =
      data.agents.length === currentAgentKeys.length &&
      data.agents.every((a, i) => a === currentAgentKeys[i])
    if (same) {
      session.flash('error', 'No changes detected')
      return response.redirect(`/strats/${params.mapSlug}/comp/suggest`)
    }

    // Validate no duplicate agents
    if (new Set(data.agents).size !== data.agents.length) {
      session.flash('error', 'Each agent can only appear once in the comp')
      return response.redirect(`/strats/${params.mapSlug}/comp/suggest`)
    }

    const rosterPlayers = await User.query().where('isOnRoster', true)
    const pool = new Set<string>()
    for (const player of rosterPlayers) {
      for (const key of player.agentPrefs) {
        pool.add(key)
      }
    }

    // Validate all agents are valid and in pool
    for (const agentKey of data.agents) {
      if (!AGENT_LOOKUP[agentKey]) {
        session.flash('error', `Invalid agent: ${agentKey}`)
        return response.redirect(`/strats/${params.mapSlug}/comp/suggest`)
      }
      if (!pool.has(agentKey)) {
        session.flash('error', `${AGENT_LOOKUP[agentKey].name} is not in the roster pool`)
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

      for (let i = 0; i < data.agents.length; i++) {
        await MapCompSuggestionSlot.create(
          {
            suggestionId: suggestion.id,
            agentKey: data.agents[i],
            slotOrder: i + 1,
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
      .preload('slots', (query) => query.orderBy('slotOrder', 'asc'))
      .firstOrFail()

    await db.transaction(async (trx) => {
      await MapCompSlot.query({ client: trx }).where('mapId', map.id).delete()

      for (const slot of suggestion.slots) {
        await MapCompSlot.create(
          {
            mapId: map.id,
            agentKey: slot.agentKey,
            slotOrder: slot.slotOrder,
          },
          { client: trx }
        )
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

  async rejectSuggestion({ params, request, response, session, view }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const suggestion = await MapCompSuggestion.query()
      .where('id', params.id)
      .where('mapId', map.id)
      .where('status', 'pending')
      .firstOrFail()

    suggestion.status = 'rejected'
    await suggestion.save()

    if (request.header('HX-Request')) {
      const compSlots = await MapCompSlot.query().where('mapId', map.id).orderBy('slotOrder', 'asc')

      const pendingSuggestions = await MapCompSuggestion.query()
        .where('mapId', map.id)
        .where('status', 'pending')
        .preload('suggestor')
        .preload('slots', (query) => query.orderBy('slotOrder', 'asc'))
        .orderBy('createdAt', 'desc')

      return view.render('partials/comp_pending_suggestions', {
        map,
        compSlots,
        pendingSuggestions,
        agentLookup: AGENT_LOOKUP,
      })
    }

    session.flash('success', 'Suggestion rejected')
    return response.redirect(`/strats/${params.mapSlug}`)
  }
}
