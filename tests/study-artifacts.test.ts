import assert from 'node:assert/strict'
import { detectStudyIntent, parseFlashcardDeck, parseGraphSpec, parseQuiz } from '../lib/ai/study-artifacts'

// --- parseQuiz -------------------------------------------------------------

{
  const reply = JSON.stringify({
    title: 'Cell Biology Basics',
    questions: [
      { question: 'What organelle produces ATP?', type: 'multiple-choice', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'], correctAnswer: 'Mitochondria', explanation: 'Mitochondria are the powerhouse of the cell.' },
      { question: 'What is the powerhouse of the cell called?', type: 'short-answer', correctAnswer: 'Mitochondria', explanation: 'Same organelle, phrased as recall.' },
      { question: 'Which organelle contains DNA?', type: 'multiple-choice', options: ['Nucleus', 'Vacuole', 'Lysosome'], correctAnswer: 'Nucleus', explanation: 'The nucleus stores genetic material.' },
    ],
  })
  const quiz = parseQuiz(reply)
  assert.ok(quiz, 'a well-formed quiz reply parses successfully')
  assert.equal(quiz?.title, 'Cell Biology Basics')
  assert.equal(quiz?.questions.length, 3)
  assert.equal(quiz?.questions[0].type, 'multiple-choice')
  assert.equal(quiz?.questions[1].type, 'short-answer')
  assert.deepEqual(quiz?.questions[1].options, [], 'short-answer questions carry no options')
}

{
  const fenced = '```json\n' + JSON.stringify({
    title: 'Quiz',
    questions: [
      { question: 'Q1', type: 'short-answer', correctAnswer: 'A1', explanation: '' },
      { question: 'Q2', type: 'short-answer', correctAnswer: 'A2', explanation: '' },
      { question: 'Q3', type: 'short-answer', correctAnswer: 'A3', explanation: '' },
    ],
  }) + '\n```'
  const quiz = parseQuiz(fenced)
  assert.ok(quiz, 'Markdown code fences around the JSON are stripped before parsing')
}

assert.equal(parseQuiz('not json at all'), null, 'unparseable text returns null instead of throwing')
assert.equal(parseQuiz(JSON.stringify({ title: 'x', questions: [] })), null, 'zero questions is rejected')

{
  // Only 2 valid questions after one is dropped for missing a correctAnswer.
  const reply = JSON.stringify({
    title: 'Too short',
    questions: [
      { question: 'Q1', type: 'short-answer', correctAnswer: 'A1' },
      { question: 'Q2', type: 'short-answer', correctAnswer: 'A2' },
      { question: 'Q3 missing answer', type: 'short-answer' },
    ],
  })
  assert.equal(parseQuiz(reply), null, 'fewer than 3 valid questions after validation is rejected as too short for a quiz')
}

{
  // Multiple-choice question whose correctAnswer isn't one of its own options must be dropped.
  const reply = JSON.stringify({
    title: 'Mismatched',
    questions: [
      { question: 'Q1', type: 'multiple-choice', options: ['A', 'B'], correctAnswer: 'C', explanation: '' },
      { question: 'Q2', type: 'short-answer', correctAnswer: 'A2' },
      { question: 'Q3', type: 'short-answer', correctAnswer: 'A3' },
      { question: 'Q4', type: 'short-answer', correctAnswer: 'A4' },
    ],
  })
  const quiz = parseQuiz(reply)
  assert.ok(quiz, 'the quiz still parses using the remaining valid questions')
  assert.equal(quiz?.questions.length, 3, 'the multiple-choice question with an out-of-options correct answer is dropped')
}

// --- parseFlashcardDeck ------------------------------------------------------

{
  const reply = JSON.stringify({
    deckTitle: 'Photosynthesis',
    cards: [
      { front: 'What is photosynthesis?', back: 'The process plants use to convert light into energy.', hint: 'Think sunlight.', difficulty: 'beginner' },
      { front: 'Where does the Calvin cycle occur?', back: 'In the stroma of the chloroplast.', hint: '', difficulty: 'intermediate' },
      { front: 'What gas is released?', back: 'Oxygen.', hint: '', difficulty: 'beginner' },
    ],
  })
  const deck = parseFlashcardDeck(reply)
  assert.ok(deck, 'a well-formed deck reply parses successfully')
  assert.equal(deck?.cards.length, 3)
  assert.equal(deck?.title, 'Photosynthesis')
}

assert.equal(parseFlashcardDeck(JSON.stringify({ deckTitle: 'x', cards: [{ front: 'only one', back: 'card' }] })), null, 'fewer than 3 valid cards is rejected')
assert.equal(parseFlashcardDeck('garbage'), null, 'unparseable text returns null')

// --- parseGraphSpec ----------------------------------------------------------

{
  const reply = JSON.stringify({ title: 'Parabola', functions: [{ expression: 'x^2', label: 'y = x^2' }] })
  const graph = parseGraphSpec(reply)
  assert.ok(graph, 'a well-formed graph reply parses successfully')
  assert.equal(graph?.functions.length, 1)
  assert.equal(graph?.functions[0].expression, 'x^2')
}

{
  // One invalid expression should be dropped, leaving the valid one.
  const reply = JSON.stringify({ title: 'Mixed', functions: [{ expression: 'x^2', label: 'valid' }, { expression: 'not$$valid((', label: 'broken' }] })
  const graph = parseGraphSpec(reply)
  assert.ok(graph, 'the graph still parses using the remaining valid function')
  assert.equal(graph?.functions.length, 1, 'the uncompilable expression is dropped rather than crashing the plot')
}

assert.equal(parseGraphSpec(JSON.stringify({ title: 'Empty', functions: [] })), null, 'zero functions is rejected')
assert.equal(parseGraphSpec(JSON.stringify({ title: 'AllInvalid', functions: [{ expression: '((', label: 'x' }] })), null, 'a graph where every function fails to compile is rejected')

{
  const reply = JSON.stringify({ title: 'Bounded', functions: [{ expression: 'x', label: 'y=x' }], xMin: -5, xMax: 5, yMin: -5, yMax: 5 })
  const graph = parseGraphSpec(reply)
  assert.equal(graph?.xMin, -5)
  assert.equal(graph?.xMax, 5)
}

{
  const reply = JSON.stringify({ title: 'BadBounds', functions: [{ expression: 'x', label: 'y=x' }], xMin: 5, xMax: -5 })
  const graph = parseGraphSpec(reply)
  assert.equal(graph?.xMin, undefined, 'an inverted bound (max <= min) is dropped instead of producing a broken viewport')
}

// --- detectStudyIntent --------------------------------------------------------

assert.equal(detectStudyIntent('make me a quiz on photosynthesis'), 'quiz')
assert.equal(detectStudyIntent('test me on world war 2'), 'quiz')
assert.equal(detectStudyIntent('can you build some flashcards for chapter 4'), 'flashcards')
assert.equal(detectStudyIntent('flash cards please'), 'flashcards')
assert.equal(detectStudyIntent('graph y = x^2 for me'), 'graph')
assert.equal(detectStudyIntent('plot sin(x) and cos(x)'), 'graph')
assert.equal(detectStudyIntent('what is the capital of France?'), null, 'an ordinary question does not trigger a structured artifact')
assert.equal(detectStudyIntent('flashcards and a quiz please'), 'flashcards', 'when a message could match multiple intents, flashcards is checked first')

console.log('Study artifacts pure-logic tests passed')
