'use client'

import { useState } from 'react'
import { Check, ClipboardCheck, RotateCcw, X } from 'lucide-react'
import type { Quiz } from '@/lib/ai/study-artifacts'
import { cn } from '@/lib/utils'

type QuizCardProps = {
  quiz: Quiz
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '')
}

function isCorrect(givenAnswer: string, correctAnswer: string) {
  const given = normalizeAnswer(givenAnswer)
  return given.length > 0 && given === normalizeAnswer(correctAnswer)
}

export function QuizCard({ quiz }: QuizCardProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const answeredCount = quiz.questions.filter((question) => (answers[question.id] ?? '').trim().length > 0).length
  const score = quiz.questions.filter((question) => isCorrect(answers[question.id] ?? '', question.correctAnswer)).length
  const percent = Math.round((score / quiz.questions.length) * 100)

  const setAnswer = (questionId: string, value: string) => {
    if (submitted) return
    setAnswers((current) => ({ ...current, [questionId]: value }))
  }

  const retake = () => {
    setAnswers({})
    setSubmitted(false)
  }

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"><ClipboardCheck className="size-5" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Interactive quiz</p>
            <h3 className="text-lg font-semibold text-white">{quiz.title}</h3>
          </div>
        </div>
        {submitted && (
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{score}/{quiz.questions.length}</p>
            <p className="text-[11px] text-slate-500">{percent}% correct</p>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {quiz.questions.map((question, index) => {
          const given = answers[question.id] ?? ''
          const correct = submitted && isCorrect(given, question.correctAnswer)
          const incorrect = submitted && !correct
          return (
            <div
              key={question.id}
              className={cn(
                'rounded-2xl border p-4 transition',
                submitted
                  ? correct ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-rose-400/25 bg-rose-400/[0.05]'
                  : 'border-white/8 bg-white/[0.025]',
              )}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">{index + 1}</span>
                <p className="flex-1 text-sm font-medium leading-6 text-white">{question.question}</p>
                {submitted && (correct ? <Check className="size-4 shrink-0 text-emerald-300" /> : <X className="size-4 shrink-0 text-rose-300" />)}
              </div>

              <div className="mt-3 ml-8 space-y-2">
                {question.type === 'multiple-choice' ? (
                  question.options.map((option) => {
                    const selected = given === option
                    const isTheCorrectOption = submitted && normalizeAnswer(option) === normalizeAnswer(question.correctAnswer)
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswer(question.id, option)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-default',
                          isTheCorrectOption
                            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                            : selected
                              ? incorrect ? 'border-rose-400/40 bg-rose-400/10 text-rose-100' : 'border-white/40 bg-white/10 text-white'
                              : 'border-white/8 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]',
                        )}
                      >
                        <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border', selected || isTheCorrectOption ? 'border-transparent bg-white' : 'border-white/25')}>
                          {(selected || isTheCorrectOption) && <span className="size-2 rounded-full bg-black" />}
                        </span>
                        {option}
                      </button>
                    )
                  })
                ) : (
                  <input
                    type="text"
                    value={given}
                    onChange={(event) => setAnswer(question.id, event.target.value)}
                    disabled={submitted}
                    placeholder="Type your answer"
                    aria-label={`Answer for question ${index + 1}`}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-white/30 disabled:cursor-default"
                  />
                )}
              </div>

              {submitted && (
                <div className="mt-3 ml-8 rounded-xl bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
                  {incorrect && <p className="mb-1 font-medium text-slate-300">Correct answer: <span className="text-white">{question.correctAnswer}</span></p>}
                  {question.explanation && <p>{question.explanation}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {!submitted ? (
          <>
            <p className="text-xs text-slate-500">{answeredCount}/{quiz.questions.length} answered</p>
            <button type="button" onClick={() => setSubmitted(true)} className="primary-action">
              <ClipboardCheck className="size-4" />Submit quiz
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500">Answers are matched exactly — a close-but-different wording may be marked wrong even if you understood it.</p>
            <button type="button" onClick={retake} className="secondary-action shrink-0">
              <RotateCcw className="size-4" />Retake
            </button>
          </>
        )}
      </div>
    </div>
  )
}
