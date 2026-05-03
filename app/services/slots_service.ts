// Tuned for ~89.8% RTP — in the same neighbourhood as Australian venue pokies
// (legal floor is 85–87.5% depending on state). All-integer payout multipliers.
// Weights sum to 27. Expected return per spin = 0.8984 of the bet:
//   3-match contributions:
//     star    1/27³ * 250  = 0.01270
//     diamond 8/27³ *  75  = 0.03048
//     bell    64/27³ * 20  = 0.06503
//     cherry  512/27³ *  6 = 0.15608
//     lemon   1728/27³ * 3 = 0.26339
//   2-cherry: 3 * (8/27)² * (19/27) * 2 = 0.37068
//   Total                               ≈ 0.89836
export type SlotSymbol = 'star' | 'diamond' | 'bell' | 'cherry' | 'lemon'

export interface SymbolDef {
  key: SlotSymbol
  emoji: string
  weight: number
  threeMatchMultiplier: number
}

export const SLOT_SYMBOLS: readonly SymbolDef[] = [
  { key: 'star', emoji: '⭐', weight: 1, threeMatchMultiplier: 250 },
  { key: 'diamond', emoji: '💎', weight: 2, threeMatchMultiplier: 75 },
  { key: 'bell', emoji: '🔔', weight: 4, threeMatchMultiplier: 20 },
  { key: 'cherry', emoji: '🍒', weight: 8, threeMatchMultiplier: 6 },
  { key: 'lemon', emoji: '🍋', weight: 12, threeMatchMultiplier: 3 },
]

export const STARTING_BALANCE = 5000
export const ALLOWED_BETS = [10, 50, 100, 500] as const
export const TWO_CHERRY_MULTIPLIER = 2

const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0)

export interface SpinResult {
  reels: SlotSymbol[]
  payout: number
  win: boolean
  payoutLabel: string | null
}

export default class SlotsService {
  static rollReel(): SlotSymbol {
    const r = Math.random() * TOTAL_WEIGHT
    let acc = 0
    for (const sym of SLOT_SYMBOLS) {
      acc += sym.weight
      if (r < acc) return sym.key
    }
    return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1].key
  }

  static spin(bet: number): SpinResult {
    const reels: SlotSymbol[] = [this.rollReel(), this.rollReel(), this.rollReel()]
    return this.evaluate(reels, bet)
  }

  static evaluate(reels: SlotSymbol[], bet: number): SpinResult {
    const allMatch = reels[0] === reels[1] && reels[1] === reels[2]
    if (allMatch) {
      const def = SLOT_SYMBOLS.find((s) => s.key === reels[0])!
      const payout = bet * def.threeMatchMultiplier
      return {
        reels,
        payout,
        win: true,
        payoutLabel: `${def.emoji}${def.emoji}${def.emoji} — ${def.threeMatchMultiplier}× payout`,
      }
    }

    const cherryCount = reels.filter((r) => r === 'cherry').length
    if (cherryCount === 2) {
      const payout = bet * TWO_CHERRY_MULTIPLIER
      return {
        reels,
        payout,
        win: true,
        payoutLabel: `🍒🍒 — ${TWO_CHERRY_MULTIPLIER}× back`,
      }
    }

    return { reels, payout: 0, win: false, payoutLabel: null }
  }

  static isAllowedBet(bet: number): bet is (typeof ALLOWED_BETS)[number] {
    return (ALLOWED_BETS as readonly number[]).includes(bet)
  }
}
