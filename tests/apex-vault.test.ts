import assert from 'node:assert/strict'
import { deriveApexRank } from '../lib/apex/config'
import { repairCostForPercent } from '../lib/apex/vault/config'
import { antiFarmMultiplier, previewVictoryXp, sanitizeLayerRow, type RawBreachLayerRow } from '../lib/apex/vault/breach-config'

// --- deriveApexRank -----------------------------------------------------

const unranked = deriveApexRank(0)
assert.equal(unranked.rank, 'unranked', 'new accounts are UNRANKED, not silently ranked')
assert.equal(unranked.nextThreshold, 100, 'next threshold is Bronze I at 100 XP')

const midBronze = deriveApexRank(225)
assert.equal(midBronze.rank, 'bronze_1', 'stays in the current band until the next threshold')
assert.ok(midBronze.progress > 0 && midBronze.progress < 1, 'progress is fractional mid-band')

const exactThreshold = deriveApexRank(350)
assert.equal(exactThreshold.rank, 'bronze_2', 'hitting a threshold exactly promotes immediately')

const maxRank = deriveApexRank(999_999)
assert.equal(maxRank.rank, 'white_wolf', 'caps at the top rank')
assert.equal(maxRank.nextThreshold, null, 'no next threshold at max rank')
assert.equal(maxRank.progress, 1, 'progress is 1 at max rank')

const negativeXp = deriveApexRank(-50)
assert.equal(negativeXp.rank, 'unranked', 'negative/corrupt XP is treated as 0, not a crash')

// --- repairCostForPercent -----------------------------------------------

assert.equal(repairCostForPercent(10), 250, 'one exact increment costs one increment price')
assert.equal(repairCostForPercent(20), 500, 'two exact increments')
assert.equal(repairCostForPercent(25), 750, 'partial increments round UP — must match what the SQL/UI actually charges')
assert.equal(repairCostForPercent(0), 0, 'zero percent costs nothing')
assert.equal(repairCostForPercent(-5), 0, 'negative input is clamped, never a negative cost')

// --- antiFarmMultiplier / previewVictoryXp ------------------------------

assert.equal(antiFarmMultiplier(0), 1, 'first breach against a target this window is full XP')
assert.equal(antiFarmMultiplier(1), 0.5, 'second breach is halved')
assert.equal(antiFarmMultiplier(2), 0.2, 'third breach is heavily diminished')
assert.equal(antiFarmMultiplier(3), 0, 'fourth breach in the window earns nothing')
assert.equal(antiFarmMultiplier(10), 0, 'multiplier never goes negative or wraps for large counts')

assert.equal(previewVictoryXp(3, false, 0), 58, 'base victory XP: (40 + 3*6) * 1')
assert.equal(previewVictoryXp(3, true, 0), 66, 'underdog bonus adds a further 8 XP at full multiplier')
assert.equal(previewVictoryXp(3, true, 1), 33, 'anti-farm multiplier applies to both the base and the underdog bonus')
assert.equal(previewVictoryXp(3, false, 3), 0, 'fully farmed-out target earns zero preview XP')

// --- sanitizeLayerRow: the hidden-information boundary ------------------

const hiddenRow: RawBreachLayerRow = {
  layer_index: 1,
  name: 'Ghost Layer',
  integrity: 35,
  strength: 70,
  is_broken: false,
  is_revealed: false,
  actions_taken: 2,
}
const hiddenDto = sanitizeLayerRow(hiddenRow)
assert.equal(hiddenDto.name, null, 'CRITICAL: an unrevealed layer must never expose the defence technology name')
assert.equal(hiddenDto.label, 'Inner Sanctum', 'label is public even when the layer is hidden')
assert.equal(hiddenDto.integrityPercent, 50, 'integrity percent is still visible while hidden')

const revealedDto = sanitizeLayerRow({ ...hiddenRow, is_revealed: true })
assert.equal(revealedDto.name, 'Ghost Layer', 'once revealed, the name passes through untouched')

const brokenButNeverRevealed = sanitizeLayerRow({ ...hiddenRow, is_broken: true, is_revealed: false })
assert.equal(brokenButNeverRevealed.name, null, 'breaking a layer does not implicitly reveal its identity — only an explicit reveal does')

const overflowLayer = sanitizeLayerRow({ ...hiddenRow, layer_index: 7, is_revealed: true })
assert.equal(overflowLayer.label, 'Core Gate', 'an out-of-range layer index falls back to Core Gate rather than throwing or leaking undefined')

console.log('Apex Nexus Vault formula/sanitization tests passed')
