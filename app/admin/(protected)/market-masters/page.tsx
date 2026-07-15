'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { GraduationCap, MessageCircleQuestion } from 'lucide-react'
import { CLASS_DISCUSSION_QUESTIONS } from '@/lib/market-masters/discussion-questions'

type StudentProgress = {
  userId: string
  displayName: string
  day: number
  portfolioValue: number
  returnPercent: number
  lessonsCompleted: number
  lessonsTotal: number
  missionsCompleted: number
  missionsTotal: number
  achievementsUnlocked: number
  diversificationScore: number
  decisionQualityRate: number | null
  misleadingNewsIdentified: number
  reflections: { day: number; text: string }[]
  mode: string
  updatedAt: string
  learningScore: number
}

export default function AdminMarketMastersPage() {
  const [students, setStudents] = useState<StudentProgress[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/market-masters', { credentials: 'include', cache: 'no-store' })
    if (response.ok) {
      setStudents(((await response.json()) as { students: StudentProgress[] }).students)
      return
    }
    const data = await response.json().catch(() => null) as { error?: string } | null
    setError(data?.error ?? 'Could not load Market Masters progress.')
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><GraduationCap className="size-5" /> Market Masters — Teacher Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranked by a learning score (lesson completion, mission completion, decision quality, diversification) — not by who made the most virtual money.
        </p>
      </header>

      {error && <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      {students == null ? (
        <p className="text-sm text-muted-foreground">Loading student progress…</p>
      ) : students.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No students have played Market Masters yet, or none have synced progress. Progress syncs automatically as students play.</p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-4 py-2.5 font-medium">Learning score</th>
                  <th className="px-4 py-2.5 font-medium">Lessons</th>
                  <th className="px-4 py-2.5 font-medium">Missions</th>
                  <th className="px-4 py-2.5 font-medium">Decision quality</th>
                  <th className="px-4 py-2.5 font-medium">Diversification</th>
                  <th className="px-4 py-2.5 font-medium">Return</th>
                  <th className="px-4 py-2.5 font-medium">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((student) => (
                  <Fragment key={student.userId}>
                    <tr
                      className="cursor-pointer hover:bg-white/[0.03]"
                      onClick={() => setExpandedUserId((current) => (current === student.userId ? null : student.userId))}
                    >
                      <td className="px-4 py-2.5 font-medium text-white">{student.displayName}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">{student.learningScore}/100</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{student.lessonsCompleted}/{student.lessonsTotal}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{student.missionsCompleted}/{student.missionsTotal}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{student.decisionQualityRate == null ? '—' : `${Math.round(student.decisionQualityRate)}%`}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{student.diversificationScore}/100</td>
                      <td className={student.returnPercent >= 0 ? 'px-4 py-2.5 text-emerald-300' : 'px-4 py-2.5 text-rose-300'}>
                        {student.returnPercent >= 0 ? '+' : ''}{student.returnPercent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">{student.mode}</td>
                    </tr>
                    {expandedUserId === student.userId && (
                      <tr>
                        <td colSpan={8} className="bg-white/[0.02] px-4 py-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Snapshot</p>
                              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                                <li>Day {student.day} · Portfolio value ${student.portfolioValue.toLocaleString()}</li>
                                <li>{student.achievementsUnlocked} achievement badge{student.achievementsUnlocked === 1 ? '' : 's'} unlocked</li>
                                <li>{student.misleadingNewsIdentified} misleading headline{student.misleadingNewsIdentified === 1 ? '' : 's'} correctly flagged</li>
                                <li>Last synced {new Date(student.updatedAt).toLocaleString()}</li>
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reflections</p>
                              {student.reflections.length === 0 ? (
                                <p className="mt-2 text-xs text-muted-foreground">No reflections submitted yet.</p>
                              ) : (
                                <ul className="mt-2 space-y-2">
                                  {student.reflections.map((reflection, index) => (
                                    <li key={index} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs leading-5 text-slate-300">
                                      <span className="text-muted-foreground">Day {reflection.day}:</span> {reflection.text}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><MessageCircleQuestion className="size-4" /> Class discussion questions</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
          {CLASS_DISCUSSION_QUESTIONS.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
