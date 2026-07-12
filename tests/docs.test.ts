import assert from 'node:assert/strict'
import { sanitizeChecklist, sanitizeTitle } from '../lib/docs/sanitize'

// --- sanitizeTitle ---------------------------------------------------------

assert.equal(sanitizeTitle('My Notes'), 'My Notes', 'a normal title passes through unchanged')
assert.equal(sanitizeTitle('   Padded   '), 'Padded', 'leading/trailing whitespace is trimmed')
assert.equal(sanitizeTitle(''), 'Untitled document', 'an empty title falls back to a default')
assert.equal(sanitizeTitle('   '), 'Untitled document', 'a whitespace-only title falls back to a default')
assert.equal(sanitizeTitle(undefined), 'Untitled document', 'a missing title falls back to a default')
assert.equal(sanitizeTitle(42), 'Untitled document', 'a non-string title falls back to a default')
assert.equal(sanitizeTitle('x'.repeat(500)).length, 200, 'an overlong title is capped at 200 characters')

// --- sanitizeChecklist -------------------------------------------------------

assert.deepEqual(sanitizeChecklist(undefined), [], 'a missing checklist becomes an empty array, not a crash')
assert.deepEqual(sanitizeChecklist('not an array'), [], 'a non-array value becomes an empty array')

{
  const result = sanitizeChecklist([{ id: 'a', text: '  Buy milk  ', done: false }])
  assert.deepEqual(result, [{ id: 'a', text: 'Buy milk', done: false }], 'a valid item is kept, with its text trimmed')
}

{
  const result = sanitizeChecklist([{ id: 'a', text: 'ok', done: false }, { id: 'b', text: 42, done: true }, 'not an object', null])
  assert.deepEqual(result, [{ id: 'a', text: 'ok', done: false }], 'malformed items (wrong types, non-objects) are dropped rather than crashing the request')
}

{
  const oversized = Array.from({ length: 80 }, (_, index) => ({ id: `item-${index}`, text: 'x', done: false }))
  assert.equal(sanitizeChecklist(oversized).length, 50, 'a checklist is capped at 50 items, matching the docs table constraint')
}

{
  const result = sanitizeChecklist([{ id: 'a', text: 'x'.repeat(500), done: false }])
  assert.equal(result[0].text.length, 300, 'an overlong item is capped at 300 characters')
}

console.log('Docs sanitize pure-logic tests passed')
