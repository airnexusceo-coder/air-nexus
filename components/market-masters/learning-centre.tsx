'use client'

import { useState } from 'react'
import { BookOpen, Check, CheckCircle2, ChevronLeft, Gem, Sparkles, X } from 'lucide-react'
import type { Lesson } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

type LearningCentreProps = {
  lessons: Lesson[]
  completedLessonIds: string[]
  onCompleteLesson: (lessonId: string, quizResult?: { correct: number; total: number }) => void
  initialLessonId?: string | null
}

export function LearningCentre({ lessons, completedLessonIds, onCompleteLesson, initialLessonId = null }: LearningCentreProps) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(initialLessonId)
  const openLesson = lessons.find((lesson) => lesson.id === openLessonId) ?? null

  if (openLesson) {
    return (
      <LessonViewer
        lesson={openLesson}
        alreadyCompleted={completedLessonIds.includes(openLesson.id)}
        onBack={() => setOpenLessonId(null)}
        onComplete={(quizResult) => onCompleteLesson(openLesson.id, quizResult)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Learning Centre</h1>
        <p className="mt-1 text-sm text-slate-400">Short lessons on investing basics, each with a quiz. Complete lessons to earn XP, bonus cash, and unlock more of the game.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lessons.map((lesson) => {
          const completed = completedLessonIds.includes(lesson.id)
          return (
            <button
              key={lesson.id}
              type="button"
              onClick={() => setOpenLessonId(lesson.id)}
              className="glass flex flex-col rounded-2xl p-4 text-left transition hover:border-white/25"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white">
                  {completed ? <CheckCircle2 className="size-4 text-emerald-300" /> : <BookOpen className="size-4" />}
                </span>
                <span className="text-xs text-slate-500">Lesson {lesson.order}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{lesson.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{lesson.summary}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Sparkles className="size-3.5 text-amber-300" />{lesson.xpReward} XP</span>
                <span className="flex items-center gap-1"><Gem className="size-3.5 text-emerald-300" />${lesson.bonusCash}</span>
              </div>
              {completed && <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">Completed</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LessonViewer({ lesson, alreadyCompleted, onBack, onComplete }: { lesson: Lesson; alreadyCompleted: boolean; onBack: () => void; onComplete: (quizResult: { correct: number; total: number }) => void }) {
  const [showQuiz, setShowQuiz] = useState(false)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const correctCount = lesson.quiz.filter((question) => answers[question.id] === question.correctIndex).length
  const allAnswered = lesson.quiz.every((question) => answers[question.id] !== undefined)

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ChevronLeft className="size-4" />
        Back to Learning Centre
      </button>

      <div>
        <h2 className="text-xl font-semibold text-white">{lesson.title}</h2>
        <p className="mt-1 text-sm text-slate-400">{lesson.summary}</p>
      </div>

      {!showQuiz ? (
        <>
          <div className="glass space-y-3 rounded-2xl p-5">
            {lesson.content.map((paragraph, index) => (
              <p key={index} className="text-sm leading-6 text-slate-300">{paragraph}</p>
            ))}
          </div>
          <button type="button" onClick={() => setShowQuiz(true)} className="primary-action">
            Take the quiz
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {lesson.quiz.map((question, questionIndex) => {
            const selected = answers[question.id]
            return (
              <div key={question.id} className="glass rounded-2xl p-4">
                <p className="text-sm font-medium text-white">{questionIndex + 1}. {question.prompt}</p>
                <div className="mt-3 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = selected === optionIndex
                    const isCorrect = optionIndex === question.correctIndex
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                          submitted
                            ? isCorrect ? 'border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-100' : isSelected ? 'border-rose-400/30 bg-rose-400/[0.06] text-rose-100' : 'border-white/10 bg-white/[0.02] text-slate-400'
                            : isSelected ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5',
                        )}
                      >
                        {option}
                        {submitted && isCorrect && <Check className="size-4 shrink-0 text-emerald-300" />}
                        {submitted && !isCorrect && isSelected && <X className="size-4 shrink-0 text-rose-300" />}
                      </button>
                    )
                  })}
                </div>
                {submitted && <p className="mt-3 text-xs leading-5 text-slate-400">{question.explanation}</p>}
              </div>
            )
          })}

          {!submitted ? (
            <button type="button" disabled={!allAnswered} onClick={() => setSubmitted(true)} className="primary-action disabled:cursor-not-allowed">
              Submit answers
            </button>
          ) : (
            <div className="glass rounded-2xl p-5">
              <p className="text-sm font-semibold text-white">You got {correctCount} of {lesson.quiz.length} correct.</p>
              {alreadyCompleted ? (
                <p className="mt-2 text-xs text-slate-400">You have already earned the reward for this lesson.</p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-slate-400">Complete this lesson to earn {lesson.xpReward} XP and ${lesson.bonusCash} bonus cash — no minimum score required, quizzes here are for learning, not gatekeeping.</p>
                  <button type="button" onClick={() => onComplete({ correct: correctCount, total: lesson.quiz.length })} className="primary-action mt-3">
                    Complete lesson
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
