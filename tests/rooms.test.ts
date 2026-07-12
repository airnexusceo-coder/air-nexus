import assert from 'node:assert/strict'
import { decideAssignmentNotify, decideCompletionNotify } from '../lib/rooms/notify-decisions'
import { colorForUser, initialsFor } from '../lib/rooms/display'

// --- decideAssignmentNotify ----------------------------------------------

{
  const decision = decideAssignmentNotify(null, 'user-b', 'user-a')
  assert.deepEqual(decision, { type: 'task_assigned', userId: 'user-b' }, 'assigning a new task to someone else notifies them')
}
{
  const decision = decideAssignmentNotify(null, 'user-a', 'user-a')
  assert.equal(decision, null, 'self-assignment never notifies')
}
{
  const decision = decideAssignmentNotify('user-b', 'user-b', 'user-a')
  assert.equal(decision, null, 'reassigning to the same person again is not a change — no notification')
}
{
  const decision = decideAssignmentNotify('user-b', null, 'user-a')
  assert.equal(decision, null, 'clearing an assignment never notifies')
}
{
  const decision = decideAssignmentNotify('user-b', 'user-c', 'user-a')
  assert.deepEqual(decision, { type: 'task_assigned', userId: 'user-c' }, 'reassigning to a different person notifies the new assignee')
}

// --- decideCompletionNotify -----------------------------------------------

{
  const decision = decideCompletionNotify('todo', 'done', 'user-b', 'user-a')
  assert.deepEqual(decision, { type: 'task_completed', userId: 'user-b' }, 'someone else completing your task notifies you')
}
{
  const decision = decideCompletionNotify('todo', 'done', 'user-a', 'user-a')
  assert.equal(decision, null, 'completing your own task never notifies yourself')
}
{
  const decision = decideCompletionNotify('done', 'done', 'user-b', 'user-a')
  assert.equal(decision, null, 'already-done tasks re-saved as done are not a completion event')
}
{
  const decision = decideCompletionNotify('todo', 'in_progress', 'user-b', 'user-a')
  assert.equal(decision, null, 'moving to in_progress is not a completion')
}
{
  const decision = decideCompletionNotify('todo', 'done', null, 'user-a')
  assert.equal(decision, null, 'an unassigned task has nobody to notify on completion')
}

// --- display helpers: deterministic, stable across calls ------------------

assert.equal(initialsFor('Elena Martins'), 'EM', 'takes the first letter of the first two words')
assert.equal(initialsFor('Cher'), 'C', 'a single-word name still produces initials, not a crash')
assert.equal(initialsFor('  spaced   name '), 'SN', 'collapses extra whitespace before taking initials')

const colorA = colorForUser('11111111-1111-1111-1111-111111111111')
const colorB = colorForUser('11111111-1111-1111-1111-111111111111')
assert.equal(colorA, colorB, 'the same user id always maps to the same color — stable across renders/requests')
assert.ok(typeof colorForUser('any-other-id') === 'string' && colorForUser('any-other-id').length > 0, 'always returns a non-empty gradient key')

console.log('Rooms notify-decision and display helper tests passed')
