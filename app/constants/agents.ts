export const AGENT_ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel'] as const

export type AgentRole = (typeof AGENT_ROLES)[number]

export type AgentDefinition = {
  key: string
  name: string
  role: AgentRole
}

export const AGENTS: AgentDefinition[] = [
  { key: 'jett', name: 'Jett', role: 'Duelist' },
  { key: 'phoenix', name: 'Phoenix', role: 'Duelist' },
  { key: 'reyna', name: 'Reyna', role: 'Duelist' },
  { key: 'raze', name: 'Raze', role: 'Duelist' },
  { key: 'yoru', name: 'Yoru', role: 'Duelist' },
  { key: 'neon', name: 'Neon', role: 'Duelist' },
  { key: 'iso', name: 'Iso', role: 'Duelist' },
  { key: 'waylay', name: 'Waylay', role: 'Duelist' },
  { key: 'sova', name: 'Sova', role: 'Initiator' },
  { key: 'breach', name: 'Breach', role: 'Initiator' },
  { key: 'skye', name: 'Skye', role: 'Initiator' },
  { key: 'kay-o', name: 'KAY/O', role: 'Initiator' },
  { key: 'fade', name: 'Fade', role: 'Initiator' },
  { key: 'gekko', name: 'Gekko', role: 'Initiator' },
  { key: 'tejo', name: 'Tejo', role: 'Initiator' },
  { key: 'brimstone', name: 'Brimstone', role: 'Controller' },
  { key: 'viper', name: 'Viper', role: 'Controller' },
  { key: 'omen', name: 'Omen', role: 'Controller' },
  { key: 'astra', name: 'Astra', role: 'Controller' },
  { key: 'harbor', name: 'Harbor', role: 'Controller' },
  { key: 'clove', name: 'Clove', role: 'Controller' },
  { key: 'sage', name: 'Sage', role: 'Sentinel' },
  { key: 'cypher', name: 'Cypher', role: 'Sentinel' },
  { key: 'killjoy', name: 'Killjoy', role: 'Sentinel' },
  { key: 'chamber', name: 'Chamber', role: 'Sentinel' },
  { key: 'deadlock', name: 'Deadlock', role: 'Sentinel' },
  { key: 'vyse', name: 'Vyse', role: 'Sentinel' },
  { key: 'veto', name: 'Veto', role: 'Sentinel' },
]

export const AGENT_KEYS = AGENTS.map((agent) => agent.key)

export const AGENTS_BY_ROLE = AGENT_ROLES.map((role) => ({
  role,
  agents: AGENTS.filter((agent) => agent.role === role),
}))

export const AGENT_LOOKUP = AGENTS.reduce<Record<string, AgentDefinition>>((acc, agent) => {
  acc[agent.key] = agent
  return acc
}, {})
