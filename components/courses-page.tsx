'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Crown,
  FileText,
  Gem,
  GraduationCap,
  Layers3,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react'

import type { NexusPlan } from '@/lib/plans'
import {
  COURSE_PURCHASE_COST,
  VCE_COURSES,
  VCE_COURSE_CATEGORIES,
  VCE_STUDY_DESIGN_SOURCE,
  currentCourseMonthKey,
  resolveCourseAccess,
  type VceCourse,
  type VceCourseChapter,
  type VceCourseLesson,
  type VceCourseLevel,
} from '@/lib/courses/vce-catalog'
import type { AiUnitLessonPack } from '@/lib/courses/lesson-pack-types'

type CoursePurchase = { id: string; courseId: string; pointsSpent: number; purchasedAt: string; expiresAt: string }

type NotifyFn = (message: string) => void

type CoursesPageProps = {
  plan: NexusPlan
  nexusPoints: number
  notify?: NotifyFn
  onRequestUpgrade: (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => void
  onPurchaseCourse: (course: { id: string; name: string }) => Promise<boolean>
}

type PlusSelection = {
  monthKey: string
  courseId: string
  unit: VceCourseLevel['unit']
}

type ActiveLesson = {
  course: VceCourse
  level: VceCourseLevel
  chapter: VceCourseChapter
  lesson: VceCourseLesson
}

type ActiveUnitLessonPack = {
  course: VceCourse
  level: VceCourseLevel
  pack: AiUnitLessonPack
}

type ActiveCourseAssessment = {
  course: VceCourse
  level: VceCourseLevel
  scope: 'unit' | 'area'
  chapter?: VceCourseChapter
}

type AiAnswerFeedback = {
  verdict: 'correct' | 'partial' | 'incorrect'
  feedback: string
  correction: string
  nextStep: string
}
const FREE_SUBJECT_KEY = 'airnexus:courses:free-subject'
const PLUS_SELECTION_KEY = 'airnexus:courses:plus-selection'
const ALL_CATEGORIES = 'All VCE'

function classNames(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(' ')
}

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}

function getCourseChips(course: VceCourse) {
  return course.description
    .replace(/\.$/, '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)
}
function isValidPlusSelection(value: unknown): value is PlusSelection {
  if (!value || typeof value !== 'object') return false
  const candidate = value as PlusSelection
  return (
    typeof candidate.monthKey === 'string' &&
    typeof candidate.courseId === 'string' &&
    [1, 2, 3, 4].includes(candidate.unit)
  )
}

export function CoursesPage({ plan, nexusPoints, notify, onRequestUpgrade, onPurchaseCourse }: CoursesPageProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [selectedCourseId, setSelectedCourseId] = useState(VCE_COURSES[0]?.id ?? '')
  const [freeSubjectId, setFreeSubjectId] = useState<string | undefined>()
  const [plusSelection, setPlusSelection] = useState<PlusSelection | undefined>()
  const [activeLesson, setActiveLesson] = useState<ActiveLesson | null>(null)
  const [activeUnitLessonPack, setActiveUnitLessonPack] = useState<ActiveUnitLessonPack | null>(null)
  const [activeAssessment, setActiveAssessment] = useState<ActiveCourseAssessment | null>(null)
  const [generatingPackKey, setGeneratingPackKey] = useState<string | null>(null)
  const [purchases, setPurchases] = useState<CoursePurchase[]>([])
  const [purchasingCourseId, setPurchasingCourseId] = useState<string | null>(null)

  const monthKey = currentCourseMonthKey()
  const monthLabel = useMemo(() => formatMonthKey(monthKey), [monthKey])

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const storedFreeSubjectId = window.localStorage.getItem(FREE_SUBJECT_KEY)
      if (storedFreeSubjectId && VCE_COURSES.some((course) => course.id === storedFreeSubjectId)) {
        setFreeSubjectId(storedFreeSubjectId)
      }

      const storedPlusSelection = window.localStorage.getItem(PLUS_SELECTION_KEY)
      if (storedPlusSelection) {
        try {
          const parsed = JSON.parse(storedPlusSelection)
          if (isValidPlusSelection(parsed) && VCE_COURSES.some((course) => course.id === parsed.courseId)) {
            setPlusSelection(parsed)
          }
        } catch {
          window.localStorage.removeItem(PLUS_SELECTION_KEY)
        }
      }

      void (async () => {
        const [selectionResponse, purchasesResponse] = await Promise.all([
          fetch('/api/courses/selection', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/courses/purchases', { credentials: 'include', cache: 'no-store' }),
        ])
        if (selectionResponse.ok) {
          const data = await selectionResponse.json() as { selection?: { freeSubjectId: string | null; plusMonthKey: string | null; plusCourseId: string | null; plusUnit: 1 | 2 | 3 | 4 | null } }
          if (data.selection?.freeSubjectId) setFreeSubjectId(data.selection.freeSubjectId)
          if (data.selection?.plusCourseId && data.selection.plusUnit && data.selection.plusMonthKey) {
            setPlusSelection({ monthKey: data.selection.plusMonthKey, courseId: data.selection.plusCourseId, unit: data.selection.plusUnit })
          }
        }
        if (purchasesResponse.ok) {
          const data = await purchasesResponse.json() as { purchases?: CoursePurchase[] }
          const now = Date.now()
          setPurchases((data.purchases ?? []).filter((purchase) => new Date(purchase.expiresAt).getTime() > now))
        }
      })()
    }, 0)

    return () => window.clearTimeout(hydrationTimer)
  }, [])

  const purchasedCourseIds = new Set(purchases.map((purchase) => purchase.courseId))

  const activePlusSelection = plusSelection?.monthKey === monthKey ? plusSelection : undefined

  const accessSelection = useMemo(
    () => ({
      freeSubjectId: plan === 'Free' ? freeSubjectId ?? null : null,
      plusMonthKey: plan === 'Plus' ? activePlusSelection?.monthKey ?? null : null,
      plusCourseId: plan === 'Plus' ? activePlusSelection?.courseId ?? null : null,
      plusUnit: plan === 'Plus' ? activePlusSelection?.unit ?? null : null,
    }),
    [activePlusSelection?.courseId, activePlusSelection?.monthKey, activePlusSelection?.unit, freeSubjectId, plan],
  )

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return VCE_COURSES.filter((course) => {
      const matchesCategory = category === ALL_CATEGORIES || course.category === category
      const matchesQuery =
        !normalizedQuery ||
        [course.name, course.category, course.description].some((item) =>
          item.toLowerCase().includes(normalizedQuery),
        )

      return matchesCategory && matchesQuery
    })
  }, [category, query])

  const selectedCourse =
    VCE_COURSES.find((course) => course.id === selectedCourseId) ?? filteredCourses[0] ?? VCE_COURSES[0]

  const resolveAccessWithPurchase = (course: VceCourse, unit: 1 | 2 | 3 | 4) => {
    if (purchasedCourseIds.has(course.id)) return { unlocked: true, reason: 'purchased' as const, requiredPlan: null }
    return resolveCourseAccess(plan, course.id, unit, accessSelection, monthKey)
  }

  const selectedAccess = useMemo(
    () =>
      selectedCourse.levels.map((level) => ({
        level,
        access: resolveAccessWithPurchase(selectedCourse, level.unit),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessSelection, monthKey, plan, selectedCourse, purchasedCourseIds],
  )

  const unlockedUnits = selectedAccess.filter((entry) => entry.access.unlocked).length
  const firstUnlockedLevel = selectedAccess.find((entry) => entry.access.unlocked)?.level ?? null
  const headerLessonPackKey = firstUnlockedLevel ? `${selectedCourse.id}:${firstUnlockedLevel.unit}` : null
  const totalLessons = selectedCourse.levels.reduce(
    (unitTotal, level) => unitTotal + level.chapters.reduce((chapterTotal, chapter) => chapterTotal + chapter.lessons.length, 0),
    0,
  )
  const freeSubject = freeSubjectId ? VCE_COURSES.find((course) => course.id === freeSubjectId) : undefined
  const plusCourse = activePlusSelection
    ? VCE_COURSES.find((course) => course.id === activePlusSelection.courseId)
    : undefined

  const chooseFreeSubject = (course: VceCourse) => {
    if (plan !== 'Free') return

    if (freeSubjectId && freeSubjectId !== course.id) {
      onRequestUpgrade(`${course.name} full course access`, 'Plus')
      return
    }

    setFreeSubjectId(course.id)
    window.localStorage.setItem(FREE_SUBJECT_KEY, course.id)
    notify?.(`${course.name} is now your free full VCE subject.`)
    void fetch('/api/courses/selection', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'free', courseId: course.id }),
    }).catch(() => undefined)
  }

  const choosePlusUnit = (course: VceCourse, level: VceCourseLevel) => {
    if (plan === 'Premium') return

    if (plan === 'Free') {
      onRequestUpgrade(`${course.name} Unit ${level.unit}`, 'Plus')
      return
    }

    const nextSelection = { monthKey, courseId: course.id, unit: level.unit }
    setPlusSelection(nextSelection)
    window.localStorage.setItem(PLUS_SELECTION_KEY, JSON.stringify(nextSelection))
    notify?.(`Unit ${level.unit} of ${course.name} is your ${monthLabel} Plus unlock.`)
    void fetch('/api/courses/selection', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'plus', courseId: course.id, unit: level.unit }),
    }).catch(() => undefined)
  }

  const purchaseCourseNow = async (course: VceCourse) => {
    if (purchasedCourseIds.has(course.id) || purchasingCourseId) return
    setPurchasingCourseId(course.id)
    try {
      const success = await onPurchaseCourse({ id: course.id, name: course.name })
      if (success) {
        const response = await fetch('/api/courses/purchases', { credentials: 'include', cache: 'no-store' })
        if (response.ok) {
          const data = await response.json() as { purchases?: CoursePurchase[] }
          setPurchases(data.purchases ?? [])
        }
      }
    } finally {
      setPurchasingCourseId(null)
    }
  }

  const getUnlockedCount = (course: VceCourse) =>
    course.levels.filter((level) => resolveAccessWithPurchase(course, level.unit).unlocked)
      .length
  const generateUnitLessonPack = async (course: VceCourse, level: VceCourseLevel, chapter?: VceCourseChapter) => {
    const key = chapter ? `${course.id}:${level.unit}:${chapter.id}` : `${course.id}:${level.unit}`
    setGeneratingPackKey(key)
    try {
      const response = await fetch('/api/courses/lesson-pack', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, unit: level.unit, plan, chapterId: chapter?.id }),
      })
      const data = await response.json().catch(() => null) as { pack?: AiUnitLessonPack; error?: string } | null
      if (!response.ok || !data?.pack) {
        throw new Error(data?.error ?? 'Could not generate this lesson pack.')
      }
      setActiveUnitLessonPack({ course, level, pack: data.pack })
      notify?.(data.pack.generatedBy === 'ai' ? 'AI lesson pack generated.' : 'Study-design lesson pack generated from fallback structure.')
    } catch (error) {
      notify?.(error instanceof Error ? error.message : 'Could not generate this lesson pack.')
    } finally {
      setGeneratingPackKey(null)
    }
  }

  return (
    <section className="flex h-full flex-col gap-5 text-white">
      <header className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                <GraduationCap className="h-3.5 w-3.5" />
                VCE Courses
              </span>
              <span className="rounded-md border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/65">
                {VCE_COURSES.length} subjects
              </span>
              <span className="rounded-md border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/65">
                Study design lessons
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-white md:text-5xl">Courses</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                VCE-only course shells structured from study-design outcomes, areas of study, key knowledge,
                key skills, SAC evidence, and revision checkpoints.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
            <StatusTile icon={Crown} label="Plan" value={plan} tone={plan === 'Premium' ? 'gold' : 'default'} />
            <StatusTile
              icon={BookOpen}
              label="Free subject"
              value={plan === 'Free' ? freeSubject?.name ?? 'Not selected' : 'Plan based'}
              tone={freeSubject && plan === 'Free' ? 'green' : 'default'}
            />
            <StatusTile
              icon={Star}
              label="Plus unlock"
              value={plan === 'Plus' ? plusCourse ? `Unit ${activePlusSelection?.unit}: ${plusCourse.name}` : monthLabel : 'Plan based'}
              tone={plusCourse && plan === 'Plus' ? 'green' : 'default'}
            />
          </div>
        </div>
      </header>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <Search className="h-4 w-4 text-white/45" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search VCE subjects"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[ALL_CATEGORIES, ...VCE_COURSE_CATEGORIES].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={classNames(
                  'shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition',
                  category === item
                    ? 'border-emerald-300/40 bg-emerald-300/14 text-emerald-50'
                    : 'border-white/10 bg-white/[0.03] text-white/58 hover:border-white/20 hover:text-white',
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-[620px] space-y-2 overflow-auto pr-1">
            {filteredCourses.map((course) => {
              const isSelected = course.id === selectedCourse.id
              const unlockedCount = getUnlockedCount(course)

              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setSelectedCourseId(course.id)}
                  className={classNames(
                    'w-full rounded-lg border p-3 text-left transition',
                    isSelected
                      ? 'border-emerald-300/40 bg-emerald-300/12 shadow-[0_0_0_1px_rgba(110,231,183,0.18)]'
                      : 'border-white/10 bg-black/18 hover:border-white/20 hover:bg-white/[0.045]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{course.name}</p>
                      <p className="mt-1 text-xs text-white/48">{course.category}</p>
                    </div>
                    <span
                      className={classNames(
                        'rounded-md border px-2 py-1 text-[11px] font-semibold',
                        unlockedCount > 0
                          ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                          : 'border-white/10 bg-white/[0.03] text-white/45',
                      )}
                    >
                      {unlockedCount}/4
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {getCourseChips(course).map((tag) => (
                      <span key={tag} className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-white/48">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}

            {filteredCourses.length === 0 && (
              <div className="rounded-lg border border-white/10 bg-black/18 p-4 text-sm text-white/55">
                No VCE subjects match that filter yet.
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/58">
                    {selectedCourse.category}
                  </span>
                  <span className="rounded-md border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/58">
                    {unlockedUnits}/4 units unlocked
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-normal text-white">{selectedCourse.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">{selectedCourse.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={VCE_STUDY_DESIGN_SOURCE.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/62 transition hover:border-white/20 hover:text-white"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Source: {VCE_STUDY_DESIGN_SOURCE.label}
                  </a>
                  <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/62">
                    <ListChecks className="h-3.5 w-3.5" />
                    {totalLessons} lesson shells
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {firstUnlockedLevel && (
                  <button
                    type="button"
                    disabled={generatingPackKey === headerLessonPackKey}
                    onClick={() => void generateUnitLessonPack(selectedCourse, firstUnlockedLevel)}
                    className="inline-flex items-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-300/12 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-wait disabled:opacity-60"
                  >
                    {generatingPackKey === headerLessonPackKey ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <BrainCircuit className="h-4 w-4" />
                    )}
                    {generatingPackKey === headerLessonPackKey
                      ? 'Building lesson...'
                      : `Build Unit ${firstUnlockedLevel.unit} AI lesson`}
                  </button>
                )}
                {plan === 'Free' && !freeSubjectId && (
                  <button
                    type="button"
                    onClick={() => chooseFreeSubject(selectedCourse)}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-300/35 bg-emerald-300/12 px-3 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/18"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Choose free subject
                  </button>
                )}
                {plan === 'Free' && freeSubjectId && freeSubjectId !== selectedCourse.id && (
                  <button
                    type="button"
                    onClick={() => onRequestUpgrade(`${selectedCourse.name} courses`, 'Plus')}
                    className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Unlock more
                  </button>
                )}
                {plan !== 'Premium' && (
                  <button
                    type="button"
                    onClick={() => onRequestUpgrade('all VCE courses', 'Premium')}
                    className="inline-flex items-center gap-2 rounded-md border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/16"
                  >
                    <Crown className="h-4 w-4" />
                    Premium all access
                  </button>
                )}
                {plan !== 'Premium' && (
                  purchasedCourseIds.has(selectedCourse.id) ? (
                    <span className="inline-flex items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100">
                      <Gem className="h-4 w-4" />
                      Purchased — open until the holidays
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={purchasingCourseId === selectedCourse.id || nexusPoints < COURSE_PURCHASE_COST}
                      onClick={() => void purchaseCourseNow(selectedCourse)}
                      className="inline-flex items-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-300/12 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {purchasingCourseId === selectedCourse.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gem className="h-4 w-4" />}
                      Buy full course · {COURSE_PURCHASE_COST.toLocaleString()} Nexus Points
                    </button>
                  )
                )}
              </div>
            </div>
            {purchasedCourseIds.has(selectedCourse.id) ? (
              <p className="mt-3 text-xs text-white/45">All 4 units are unlocked until the next school holidays.</p>
            ) : plan !== 'Premium' ? (
              <p className="mt-3 text-xs text-white/45">Buying unlocks all 4 units of {selectedCourse.name} until the next school holidays — no monthly rotation.</p>
            ) : null}
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            {selectedAccess.map(({ level, access }) => (
              <UnitCard
                key={level.unit}
                course={selectedCourse}
                level={level}
                unlocked={access.unlocked}
                reason={access.reason}
                plan={plan}
                isPlusSelected={
                  plan === 'Plus' &&
                  activePlusSelection?.courseId === selectedCourse.id &&
                  activePlusSelection.unit === level.unit
                }
                hasFreeSubjectChoice={Boolean(freeSubjectId)}
                onChooseFree={() => chooseFreeSubject(selectedCourse)}
                onChoosePlus={() => choosePlusUnit(selectedCourse, level)}
                onOpenLesson={(chapter, lesson) => setActiveLesson({ course: selectedCourse, level, chapter, lesson })}
                onOpenAreaTest={(chapter) => setActiveAssessment({ course: selectedCourse, level, chapter, scope: 'area' })}
                onOpenUnitTest={() => setActiveAssessment({ course: selectedCourse, level, scope: 'unit' })}
                onGenerateUnitLesson={() => void generateUnitLessonPack(selectedCourse, level)}
                generatingLessonPack={generatingPackKey === `${selectedCourse.id}:${level.unit}`}
                onGenerateAreaLesson={(chapter) => void generateUnitLessonPack(selectedCourse, level, chapter)}
                generatingAreaLessonKey={generatingPackKey}
                onUpgrade={(requiredPlan) =>
                  onRequestUpgrade(`${selectedCourse.name} Unit ${level.unit}`, requiredPlan)
                }
              />
            ))}
          </section>
        </main>
      </div>

      {activeLesson && (
        <LessonStudyModal key={activeLesson.lesson.id} activeLesson={activeLesson} onClose={() => setActiveLesson(null)} />
      )}
      {activeAssessment && (
        <CourseAssessmentModal
          key={`${activeAssessment.scope}-${activeAssessment.level.unit}-${activeAssessment.chapter?.id ?? 'unit'}`}
          activeAssessment={activeAssessment}
          onClose={() => setActiveAssessment(null)}
        />
      )}
      {activeUnitLessonPack && (
        <UnitLessonPackModal
          key={activeUnitLessonPack.pack.id}
          activePack={activeUnitLessonPack}
          onClose={() => setActiveUnitLessonPack(null)}
        />
      )}
    </section>
  )
}
type StatusTileProps = {
  icon: typeof Crown
  label: string
  value: string
  tone?: 'default' | 'green' | 'gold'
}

function StatusTile({ icon: Icon, label, value, tone = 'default' }: StatusTileProps) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/22 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/42">
        <Icon
          className={classNames(
            'h-4 w-4',
            tone === 'green' && 'text-emerald-200',
            tone === 'gold' && 'text-amber-200',
            tone === 'default' && 'text-white/52',
          )}
        />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

type UnitCardProps = {
  course: VceCourse
  level: VceCourseLevel
  unlocked: boolean
  reason: string
  plan: NexusPlan
  isPlusSelected: boolean
  hasFreeSubjectChoice: boolean
  onChooseFree: () => void
  onChoosePlus: () => void
  onUpgrade: (requiredPlan: Exclude<NexusPlan, 'Free'>) => void
  onOpenLesson: (chapter: VceCourseChapter, lesson: VceCourseLesson) => void
  onOpenAreaTest: (chapter: VceCourseChapter) => void
  onOpenUnitTest: () => void
  onGenerateUnitLesson: () => void
  generatingLessonPack: boolean
  onGenerateAreaLesson: (chapter: VceCourseChapter) => void
  generatingAreaLessonKey: string | null
}

function UnitCard({
  course,
  level,
  unlocked,
  reason,
  plan,
  isPlusSelected,
  hasFreeSubjectChoice,
  onChooseFree,
  onChoosePlus,
  onUpgrade,
  onOpenLesson,
  onOpenAreaTest,
  onOpenUnitTest,
  onGenerateUnitLesson,
  generatingLessonPack,
  onGenerateAreaLesson,
  generatingAreaLessonKey,
}: UnitCardProps) {
  const statusLabel = unlocked ? 'Unlocked' : 'Locked'
  const Icon = unlocked ? CheckCircle2 : LockKeyhole
  const lessonCount = level.chapters.reduce((total, chapter) => total + chapter.lessons.length, 0)

  return (
    <article
      className={classNames(
        'relative overflow-hidden rounded-lg border p-4 transition',
        unlocked
          ? 'border-emerald-300/28 bg-emerald-300/[0.055]'
          : 'border-white/10 bg-black/20',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-white/68">
              Unit {level.unit}
            </span>
            <span
              className={classNames(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold',
                unlocked
                  ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                  : 'border-white/10 bg-white/[0.035] text-white/48',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {statusLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/18 px-2.5 py-1 text-xs font-semibold text-white/48">
              <ListChecks className="h-3.5 w-3.5" />
              {level.chapters.length} chapters / {lessonCount} lessons
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-normal text-white">{level.title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/58">{level.focus}</p>
        </div>
        <Layers3 className="h-5 w-5 shrink-0 text-white/32" />
      </div>

      <div className="mt-4 space-y-3">
        {level.chapters.map((chapter, index) => (
          <ChapterBlock
            key={chapter.id}
            chapter={chapter}
            chapterNumber={index + 1}
            locked={!unlocked}
            onOpenLesson={onOpenLesson}
            onOpenAreaTest={onOpenAreaTest}
            onGenerateAreaLesson={onGenerateAreaLesson}
            generatingAreaLesson={generatingAreaLessonKey === `${course.id}:${level.unit}:${chapter.id}`}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs text-white/45">
          {unlocked ? 'Lessons are scaffolded from study-design outcomes, key knowledge and key skills.' : reason}
        </p>
        {unlocked ? (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Lessons open
            </span>
            <button
              type="button"
              onClick={onOpenUnitTest}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-50 transition hover:bg-amber-300/16"
            >
              <ListChecks className="h-3.5 w-3.5" />
              Unit test
            </button>
            <button
              type="button"
              disabled={generatingLessonPack}
              onClick={onGenerateUnitLesson}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/16 disabled:cursor-wait disabled:opacity-60"
            >
              {generatingLessonPack ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generatingLessonPack ? 'Building...' : 'AI unit lesson'}
            </button>
          </div>
        ) : plan === 'Free' && !hasFreeSubjectChoice ? (
          <button
            type="button"
            onClick={onChooseFree}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-300/16"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Choose {course.name}
          </button>
        ) : plan === 'Plus' ? (
          <button
            type="button"
            onClick={onChoosePlus}
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/16"
          >
            <Star className="h-3.5 w-3.5" />
            {isPlusSelected ? 'Monthly unlock' : 'Use monthly unlock'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUpgrade(plan === 'Free' ? 'Plus' : 'Premium')}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <Crown className="h-3.5 w-3.5" />
            Upgrade
          </button>
        )}
      </div>
    </article>
  )
}

function ChapterBlock({
  chapter,
  chapterNumber,
  locked,
  onOpenLesson,
  onOpenAreaTest,
  onGenerateAreaLesson,
  generatingAreaLesson,
}: {
  chapter: VceCourseChapter
  chapterNumber: number
  locked: boolean
  onOpenLesson: (chapter: VceCourseChapter, lesson: VceCourseLesson) => void
  onOpenAreaTest: (chapter: VceCourseChapter) => void
  onGenerateAreaLesson: (chapter: VceCourseChapter) => void
  generatingAreaLesson: boolean
}) {
  return (
    <div className={classNames('border-t border-white/10 pt-3', locked && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/18 px-2.5 py-1 text-xs font-semibold text-white/50">
          <CircleDot className="h-3.5 w-3.5" />
          Chapter {chapterNumber}
        </span>
        <span className="rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-semibold text-white/45">
          {chapter.studyDesignFocus}
        </span>
        <button
          type="button"
          disabled={locked}
          onClick={() => onOpenAreaTest(chapter)}
          className="rounded-md border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-50 transition hover:bg-amber-300/16 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Area test
        </button>
        <button
          type="button"
          disabled={locked || generatingAreaLesson}
          onClick={() => onGenerateAreaLesson(chapter)}
          className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {generatingAreaLesson ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generatingAreaLesson ? 'Building 50 slides...' : 'Deep-dive lesson (50 slides)'}
        </button>
      </div>
      <h4 className="mt-2 text-sm font-semibold text-white">{chapter.title}</h4>
      <p className="mt-1 text-xs leading-5 text-white/50">{chapter.outcome}</p>

      <div className="mt-3 grid gap-2">
        {chapter.lessons.map((lesson, index) => (
          <button
            key={lesson.id}
            type="button"
            disabled={locked}
            onClick={() => onOpenLesson(chapter, lesson)}
            className={classNames(
              'w-full rounded-md border border-white/10 bg-black/18 px-3 py-2 text-left transition',
              locked ? 'cursor-not-allowed' : 'hover:border-emerald-300/30 hover:bg-emerald-300/[0.055]',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
                Lesson {index + 1}
              </span>
              <span className="rounded-md bg-white/[0.055] px-2 py-0.5 text-[11px] text-white/42">
                {lesson.studyDesignFocus}
              </span>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/84">{lesson.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/52">{lesson.objective}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/28" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-white/[0.035] px-2.5 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/32">Key knowledge</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/52">
                  {lesson.keyKnowledge.map((point) => point.detail).join('; ')}
                </p>
              </div>
              <div className="rounded-md bg-white/[0.035] px-2.5 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/32">Command terms</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/52">
                  {lesson.commandTerms.map((term) => term.term).join(', ')}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
type AssessmentQuestion = {
  id: string
  label: string
  source: string
  question: string
  example: string
  answerGuide: string
  commandTerm?: string
}

function defaultCommandTermForCourse(course: VceCourse) {
  switch (course.category) {
    case 'English':
      return 'Analyse'
    case 'Mathematics':
      return 'Solve'
    case 'Science':
      return 'Explain'
    case 'Humanities':
      return 'Evaluate'
    case 'Business':
      return 'Apply'
    case 'Health and PE':
      return 'Explain'
    case 'Technology':
      return 'Justify'
    case 'Arts':
      return 'Analyse'
    case 'Languages':
      return 'Compose'
  }
}

function subjectExample(course: VceCourse, chapter: VceCourseChapter, point: { detail: string }) {
  switch (course.category) {
    case 'English':
      return `Example: use one short quote, image, scene, argument move or structural choice from the text. Explain how it positions the audience or creates meaning, then link it back to ${point.detail}.`
    case 'Mathematics':
      return `Example: define the variable or model first, show the working line by line, then interpret the answer in context. If restrictions, units or technology outputs matter, include them.`
    case 'Science':
      return `Example: describe the mechanism step by step, then connect it to data, an investigation condition, a model or an observed result. Use cause-and-effect language.`
    case 'Humanities':
      return `Example: use a source, event, place, policy, group, map, case study or data pattern. Explain what the evidence shows and why it is significant for ${chapter.title}.`
    case 'Business':
      return `Example: apply the idea to a business, legal or economic scenario. Name the stakeholder, decision or pressure, then explain the consequence for performance or objectives.`
    case 'Health and PE':
      return `Example: connect the factor to a specific health, wellbeing, movement, body-system or performance outcome. Use data or a scenario to prove the link.`
    case 'Technology':
      return `Example: refer to a user need, constraint, design decision, system component, test result or evaluation criterion. Explain why that evidence supports the solution.`
    case 'Arts':
      return `Example: refer to a specific convention, material, process, rehearsal choice, production element or artwork feature. Explain how it creates meaning for an audience.`
    case 'Languages':
      return `Example: use a sentence that shows accurate vocabulary, grammar, register and cultural context. Explain why the language choice suits the audience and purpose.`
  }
}

function subjectQuestion(course: VceCourse, chapter: VceCourseChapter, commandTerm: string, point: { detail: string }) {
  switch (course.category) {
    case 'English':
      return `${commandTerm} how ${point.detail} shapes meaning, argument or audience response in ${chapter.title}. Use evidence in your answer.`
    case 'Mathematics':
      return `${commandTerm} a VCE-style task involving ${point.detail}. Show the method, key working, and interpretation needed for full marks.`
    case 'Science':
      return `${commandTerm} how ${point.detail} works in ${chapter.title}. Include the mechanism, conditions and evidence that would support the explanation.`
    case 'Humanities':
      return `${commandTerm} the significance of ${point.detail} in ${chapter.title}. Use evidence from a source, place, event, group or case study.`
    case 'Business':
      return `${commandTerm} ${point.detail} to a realistic scenario in ${chapter.title}. Explain the effect on stakeholders, objectives or outcomes.`
    case 'Health and PE':
      return `${commandTerm} how ${point.detail} influences a health, wellbeing, movement or performance outcome in ${chapter.title}.`
    case 'Technology':
      return `${commandTerm} how ${point.detail} would guide a design, system, product or evaluation decision in ${chapter.title}.`
    case 'Arts':
      return `${commandTerm} how ${point.detail} is shown through creative choices, process evidence or production conventions in ${chapter.title}.`
    case 'Languages':
      return `${commandTerm} a response that communicates ${point.detail} for a clear audience, purpose and register in ${chapter.title}.`
  }
}

function buildAssessmentQuestions(activeAssessment: ActiveCourseAssessment): AssessmentQuestion[] {
  const { course, level, scope } = activeAssessment
  const chapters = scope === 'area' && activeAssessment.chapter ? [activeAssessment.chapter] : level.chapters
  const targetCount = scope === 'unit' ? 8 : 5
  const entries = chapters.flatMap((chapter) =>
    chapter.lessons.flatMap((lesson) =>
      lesson.keyKnowledge.map((point, pointIndex) => {
        const commandTerm = lesson.commandTerms[pointIndex % Math.max(1, lesson.commandTerms.length)]?.term ?? defaultCommandTermForCourse(course)
        return { chapter, lesson, point, commandTerm }
      }),
    ),
  )

  const questions = entries.slice(0, targetCount).map((entry, index): AssessmentQuestion => ({
    id: `${scope}-${level.unit}-${entry.chapter.id}-${entry.lesson.id}-${index}`,
    label: scope === 'unit' ? `Unit ${level.unit} Question ${index + 1}` : `Area of Study Question ${index + 1}`,
    source: `${entry.chapter.title} / ${entry.lesson.title}`,
    question: subjectQuestion(course, entry.chapter, entry.commandTerm, entry.point),
    example: subjectExample(course, entry.chapter, entry.point),
    answerGuide: `${entry.point.answerGuide} A strong response should directly use ${entry.point.detail}, connect it to ${entry.chapter.title}, and follow the ${entry.commandTerm} command term.`,
    commandTerm: entry.commandTerm,
  }))

  if (scope === 'unit' && chapters.length > 1) {
    const first = chapters[0]
    const last = chapters[chapters.length - 1]
    questions.push({
      id: `unit-${level.unit}-synthesis`,
      label: `Unit ${level.unit} Synthesis`,
      source: `${first.title} + ${last.title}`,
      question: `${defaultCommandTermForCourse(course)} how two ideas from different Areas of Study in Unit ${level.unit} connect. Use one example from each area.`,
      example: `Example: compare one point from ${first.title} with one point from ${last.title}. Show the link, then explain why the connection matters for the unit outcome rather than listing two separate facts.`,
      answerGuide: `A strong synthesis answer uses one accurate point from each Area of Study, explains the relationship between them, and finishes with a clear judgement or explanation linked to ${level.title}.`,
      commandTerm: defaultCommandTermForCourse(course),
    })
  }

  return questions
}

function CourseAssessmentModal({ activeAssessment, onClose }: { activeAssessment: ActiveCourseAssessment; onClose: () => void }) {
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const [answerFeedbackByQuestion, setAnswerFeedbackByQuestion] = useState<Record<string, AiAnswerFeedback | undefined>>({})
  const [checkingQuestionId, setCheckingQuestionId] = useState<string | null>(null)
  const questions = useMemo(() => buildAssessmentQuestions(activeAssessment), [activeAssessment])
  const title = activeAssessment.scope === 'unit'
    ? `${activeAssessment.course.name} Unit ${activeAssessment.level.unit} Test`
    : `${activeAssessment.course.name} Area of Study Test`
  const subtitle = activeAssessment.scope === 'unit'
    ? activeAssessment.level.title
    : activeAssessment.chapter?.title ?? activeAssessment.level.title

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const checkAssessmentAnswer = async (question: AssessmentQuestion) => {
    const answer = answerDrafts[question.id]?.trim() ?? ''
    if (!answer) return
    setCheckingQuestionId(question.id)
    setAnswerFeedbackByQuestion((current) => ({ ...current, [question.id]: undefined }))

    try {
      const response = await fetch('/api/courses/check-answer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeAssessment.course.id,
          unit: activeAssessment.level.unit,
          question: question.question,
          answer,
          answerGuide: `${question.answerGuide}\n\nExample support: ${question.example}`,
          commandTerm: question.commandTerm,
        }),
      })
      const data = await response.json().catch(() => null) as { feedback?: AiAnswerFeedback; error?: string } | null
      if (!response.ok || !data?.feedback) throw new Error(data?.error ?? 'Could not mark this answer.')
      setAnswerFeedbackByQuestion((current) => ({ ...current, [question.id]: data.feedback }))
    } catch (error) {
      setAnswerFeedbackByQuestion((current) => ({
        ...current,
        [question.id]: {
          verdict: 'partial',
          feedback: error instanceof Error ? error.message : 'Could not mark this answer.',
          correction: 'Use the example, the key knowledge, and the command term to make the answer more specific.',
          nextStep: 'Rewrite with one clearer piece of evidence or working, then mark it again.',
        },
      }))
    } finally {
      setCheckingQuestionId((current) => current === question.id ? null : current)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/76 px-4 py-6 backdrop-blur-md">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-white/12 bg-[#080a0c] shadow-[0_24px_100px_rgba(0,0,0,0.58)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/70">{activeAssessment.scope === 'unit' ? 'Unit test' : 'Area of Study test'}</p>
            <h3 className="mt-1 truncate text-base font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs text-white/45">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assessment"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-auto lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b border-white/10 bg-white/[0.025] p-4 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-100">{questions.length} questions</span>
              <span className="rounded-md border border-white/10 bg-black/18 px-2.5 py-1 text-xs font-semibold text-white/45">{activeAssessment.course.category}</span>
            </div>
            <div className="mt-4 space-y-2">
              {questions.map((question, index) => (
                <a key={question.id} href={`#${question.id}`} className="flex items-start gap-3 rounded-md border border-white/10 bg-black/18 px-3 py-2 text-sm text-white/58 transition hover:border-amber-300/25 hover:text-white">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-xs font-semibold">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{question.label}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-white/35">{question.source}</span>
                  </span>
                </a>
              ))}
            </div>
          </aside>

          <section className="min-w-0 space-y-4 p-5 sm:p-7">
            <div className="rounded-lg border border-amber-300/18 bg-amber-300/[0.055] p-4">
              <p className="text-sm leading-6 text-white/72">Each question includes a subject-specific example. Use it as a model for the kind of evidence, working or context your answer should contain, then submit your own response for marking.</p>
            </div>
            {questions.map((question, index) => {
              const answerText = answerDrafts[question.id] ?? ''
              const answerFeedback = answerFeedbackByQuestion[question.id]
              const checkingAnswer = checkingQuestionId === question.id

              return (
                <article id={question.id} key={question.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-white/48">Question {index + 1}</span>
                    {question.commandTerm && <span className="rounded-md border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-100">{question.commandTerm}</span>}
                  </div>
                  <h4 className="mt-3 text-base font-semibold leading-7 text-white">{question.question}</h4>
                  <div className="mt-4 rounded-lg border border-cyan-300/18 bg-cyan-300/[0.055] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-cyan-100/70">Example</p>
                    <p className="mt-2 text-sm leading-6 text-white/72">{question.example}</p>
                  </div>
                  <textarea
                    value={answerText}
                    onChange={(event) => setAnswerDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                    rows={6}
                    placeholder="Type your test answer here..."
                    className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-amber-300/35"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-white/45">Marked against the answer guide, example, key knowledge and command term.</p>
                    <button
                      type="button"
                      disabled={checkingAnswer || !answerText.trim()}
                      onClick={() => void checkAssessmentAnswer(question)}
                      className="inline-flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/12 px-3 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {checkingAnswer ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {checkingAnswer ? 'Marking...' : 'Mark answer'}
                    </button>
                  </div>
                  {answerFeedback && <AnswerFeedbackPanel feedback={answerFeedback} />}
                </article>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}
type LessonSlideItem = {
  label: string
  detail: string
  question?: string
  answerGuide?: string
  commandTerm?: string
}

type LessonSlide = {
  eyebrow: string
  title: string
  body: string
  paragraphs: string[]
  items: LessonSlideItem[]
}

function LessonStudyModal({ activeLesson, onClose }: { activeLesson: ActiveLesson; onClose: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const [answerFeedbackByQuestion, setAnswerFeedbackByQuestion] = useState<Record<string, AiAnswerFeedback | undefined>>({})
  const [checkingQuestionKey, setCheckingQuestionKey] = useState<string | null>(null)

  const slides = useMemo<LessonSlide[]>(
    () => [
      {
        eyebrow: `${activeLesson.course.name} / ${activeLesson.level.title}`,
        title: activeLesson.lesson.title,
        body: activeLesson.lesson.objective,
        paragraphs: [
          `This lesson starts with the main learning goal: ${activeLesson.lesson.objective} Read it as a promise about what you should be able to explain by the end, not as a heading. The slideshow breaks that goal into concepts, examples, mistakes to avoid, and answer moves.`,
          `The chapter context matters because VCE questions rarely ask for isolated facts. This lesson sits inside ${activeLesson.chapter.title}, and the outcome is: ${activeLesson.chapter.outcome} That outcome tells you what your knowledge needs to do in a response.`,
          `As you study, keep translating each point into three parts: what it is, how it works, and how it would appear in a SAC, exam-style response, source analysis, worked solution or practical task.`,
        ],
        items: [
          { label: 'VCE chapter', detail: activeLesson.chapter.title },
          { label: 'Outcome', detail: activeLesson.chapter.outcome },
          { label: 'Study-design focus', detail: activeLesson.lesson.studyDesignFocus },
        ],
      },
      {
        eyebrow: 'Learn',
        title: 'Teach The Key Points',
        body: 'Read each point like a mini lesson. The goal is not to memorise the heading; it is to understand what the study design expects you to explain or apply.',
        paragraphs: [
          `A VCE key knowledge point is usually compact because the study design is a planning document, not a textbook. Your job is to turn that compact wording into an explanation you could use in class or assessment.`,
          `For each point, first ask what the idea is. Then ask how it works inside ${activeLesson.chapter.title}. Finally, ask how it helps meet the outcome. If you can answer those three questions, the point has become usable knowledge instead of a phrase you recognise.`,
        ],
        items: activeLesson.lesson.keyKnowledge.map((point) => ({
          label: point.detail,
          detail: `${point.explanation} Treat this as an idea to explain in your own words, then connect it back to ${activeLesson.chapter.title}.`,
        })),
      },
      {
        eyebrow: 'Apply',
        title: 'VCE Examples',
        body: 'Each example shows how the point might appear in a VCE-style lesson, SAC response or exam-style question.',
        paragraphs: [
          `Examples are where the idea becomes visible. Do not treat an example as a random extra sentence. In VCE, an example should prove that you can apply the concept to a text, source, case, data set, method, design, performance, calculation or scenario.`,
          `When you read each example, ask what it proves. A useful example should connect back to the key knowledge and show why the point matters. If the connection is not clear, add one more explanatory sentence before moving on.`,
        ],
        items: activeLesson.lesson.keyKnowledge.map((point) => ({
          label: point.label,
          detail: `${point.vceExample} Use this as a model: name the example, explain what it shows, and link it back to ${point.detail}.`,
        })),
      },
      {
        eyebrow: 'Avoid',
        title: 'Common Misconceptions',
        body: 'Use these to catch the mistakes that make an answer sound like notes instead of a VCE response.',
        paragraphs: [
          `Misconceptions matter because many weak answers sound close to correct. They use the right topic words but miss the relationship, evidence, process or judgement that the question requires.`,
          `For each misconception, compare the weak version with the stronger version you would write. A stronger answer usually adds a cause, effect, example, comparison, interpretation, step, context or reason.`,
        ],
        items: activeLesson.lesson.keyKnowledge.map((point) => ({
          label: point.detail,
          detail: `${point.misconception} To fix this, return to what the point means and add the missing explanation.`,
        })),
      },
      {
        eyebrow: 'Question',
        title: 'Check Questions',
        body: 'Answer these before moving on. Type your response under each question and let the tutor mark it against the lesson point.',
        paragraphs: [
          `These questions are not quick recall checks. They ask you to turn the lesson into a VCE-style response. Read the command word, decide what type of thinking it asks for, and plan the answer before you write.`,
          `After the AI marks your answer, use the feedback to rewrite one sentence. The goal is not just to be told correct or incorrect; the goal is to learn which part of the response needs more knowledge, clearer reasoning or a stronger link to the command term.`,
        ],
        items: activeLesson.lesson.keyKnowledge.map((point) => ({
          label: point.checkQuestion,
          detail: `Write a full VCE answer. Include the key idea, explain the reasoning, and link back to ${point.detail}.`,
          question: point.checkQuestion,
          answerGuide: point.answerGuide,
          commandTerm: activeLesson.lesson.commandTerms[0]?.term,
        })),
      },
      {
        eyebrow: 'Command Terms',
        title: 'How To Answer',
        body: 'These command terms shape the response. Students should practise the response move, not just remember the definition.',
        paragraphs: [
          `Command terms tell you what the answer has to do. Two questions can use the same content but require different responses because one asks you to identify, another asks you to explain, and another asks you to evaluate or justify.`,
          `Before writing, translate the command term into an action. Then choose the knowledge that helps you perform that action. This stops the response from becoming a dump of everything you remember.`,
        ],
        items: activeLesson.lesson.commandTerms.map((term) => ({
          label: term.term,
          detail: `${term.meaning} Response move: ${term.responseMove} Shape your paragraph around that action.`,
        })),
      },
    ],
    [activeLesson],
  )

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setSlideIndex((current) => Math.max(0, current - 1))
      if (event.key === 'ArrowRight') setSlideIndex((current) => Math.min(slides.length - 1, current + 1))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, slides.length])

  const currentSlide = slides[slideIndex]
  const canGoBack = slideIndex > 0
  const canGoForward = slideIndex < slides.length - 1
  const lessonQuestionKey = (item: LessonSlideItem, itemIndex: number) => `${activeLesson.lesson.id}:${currentSlide.title}:${itemIndex}:${item.question ?? item.label}`

  const checkLessonAnswer = async (item: LessonSlideItem, itemIndex: number) => {
    const question = item.question ?? item.label
    const key = lessonQuestionKey(item, itemIndex)
    const answer = answerDrafts[key]?.trim() ?? ''
    if (!answer) return
    setCheckingQuestionKey(key)
    setAnswerFeedbackByQuestion((current) => ({ ...current, [key]: undefined }))

    try {
      const response = await fetch('/api/courses/check-answer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeLesson.course.id,
          unit: activeLesson.level.unit,
          question,
          answer,
          answerGuide: item.answerGuide ?? item.detail,
          commandTerm: item.commandTerm,
        }),
      })
      const data = await response.json().catch(() => null) as { feedback?: AiAnswerFeedback; error?: string } | null
      if (!response.ok || !data?.feedback) {
        throw new Error(data?.error ?? 'Could not check this answer.')
      }
      setAnswerFeedbackByQuestion((current) => ({ ...current, [key]: data.feedback }))
    } catch (error) {
      setAnswerFeedbackByQuestion((current) => ({
        ...current,
        [key]: {
          verdict: 'partial',
          feedback: error instanceof Error ? error.message : 'Could not check this answer.',
          correction: 'Use the key knowledge from the lesson, then explain it in your own words.',
          nextStep: 'Rewrite your answer with a clearer reason, example or command-term finish.',
        },
      }))
    } finally {
      setCheckingQuestionKey((current) => current === key ? null : current)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-md">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/12 bg-[#080a0c] shadow-[0_24px_100px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Lesson slides</p>
            <h3 className="mt-1 truncate text-base font-semibold text-white">{activeLesson.course.name} / {activeLesson.level.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close lesson slides"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-auto lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-white/10 bg-white/[0.025] p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  onClick={() => setSlideIndex(index)}
                  className={classNames(
                    'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition',
                    slideIndex === index
                      ? 'border-emerald-300/35 bg-emerald-300/12 text-white'
                      : 'border-white/10 bg-black/18 text-white/52 hover:border-white/20 hover:text-white',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="min-w-0 truncate">{slide.title}</span>
                </button>
              ))}
            </div>
            <a
              href={activeLesson.course.studyDesign.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/18 px-3 py-2 text-xs font-semibold text-white/55 transition hover:border-white/20 hover:text-white"
            >
              <FileText className="h-3.5 w-3.5" />
              VCAA study designs
            </a>
          </aside>

          <section className="min-w-0 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
                {currentSlide.eyebrow}
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-white/45">
                Slide {slideIndex + 1} of {slides.length}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-normal text-white sm:text-4xl">{currentSlide.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62">{currentSlide.body}</p>

            {currentSlide.paragraphs.length > 0 && (
              <div className="mt-6 max-w-4xl space-y-4">
                {currentSlide.paragraphs.map((paragraph, index) => (
                  <p key={`${currentSlide.title}-paragraph-${index}`} className="text-base leading-8 text-white/76">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-3">
              {currentSlide.items.map((item, itemIndex) => {
                const questionKey = lessonQuestionKey(item, itemIndex)
                const answerText = answerDrafts[questionKey] ?? ''
                const answerFeedback = answerFeedbackByQuestion[questionKey]
                const checkingAnswer = checkingQuestionKey === questionKey

                return (
                  <div key={`${item.label}-${item.detail}`} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/38">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-white/72">{item.detail}</p>
                    {item.question && (
                      <div className="mt-4 rounded-lg border border-emerald-300/18 bg-emerald-300/[0.055] p-4">
                        <textarea
                          value={answerText}
                          onChange={(event) => setAnswerDrafts((current) => ({ ...current, [questionKey]: event.target.value }))}
                          rows={5}
                          placeholder="Type your answer here..."
                          className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-emerald-300/35"
                        />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-white/45">The tutor checks knowledge, reasoning and command-term structure.</p>
                          <button
                            type="button"
                            disabled={checkingAnswer || !answerText.trim()}
                            onClick={() => void checkLessonAnswer(item, itemIndex)}
                            className="inline-flex items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/12 px-3 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {checkingAnswer ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {checkingAnswer ? 'Marking...' : 'Mark answer'}
                          </button>
                        </div>
                        {answerFeedback && (
                          <AnswerFeedbackPanel feedback={answerFeedback} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => setSlideIndex((current) => Math.max(0, current - 1))}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => setSlideIndex(index)}
                className={classNames(
                  'h-2.5 w-2.5 rounded-full transition',
                  slideIndex === index ? 'bg-emerald-200' : 'bg-white/18 hover:bg-white/35',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => setSlideIndex((current) => Math.min(slides.length - 1, current + 1))}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
function UnitLessonPackModal({ activePack, onClose }: { activePack: ActiveUnitLessonPack; onClose: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const [answerFeedbackBySlide, setAnswerFeedbackBySlide] = useState<Record<string, AiAnswerFeedback | undefined>>({})
  const [checkingSlideId, setCheckingSlideId] = useState<string | null>(null)
  const slides = activePack.pack.slides
  const currentSlide = slides[slideIndex] ?? slides[0]
  const canGoBack = slideIndex > 0
  const canGoForward = slideIndex < slides.length - 1
  const hasAnswerCheck = Boolean(currentSlide?.question)
  const activeSlideId = currentSlide?.id ?? ''
  const answerText = activeSlideId ? answerDrafts[activeSlideId] ?? '' : ''
  const answerFeedback = activeSlideId ? answerFeedbackBySlide[activeSlideId] ?? null : null
  const checkingAnswer = checkingSlideId === activeSlideId
  const slideParagraphs = currentSlide?.paragraphs?.length ? currentSlide.paragraphs : []

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setSlideIndex((current) => Math.max(0, current - 1))
      if (event.key === 'ArrowRight') setSlideIndex((current) => Math.min(slides.length - 1, current + 1))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, slides.length])

  const checkStudentAnswer = async () => {
    if (!currentSlide?.question || !answerText.trim()) return
    setCheckingSlideId(currentSlide.id)
    setAnswerFeedbackBySlide((current) => ({ ...current, [currentSlide.id]: undefined }))

    try {
      const response = await fetch('/api/courses/check-answer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activePack.course.id,
          unit: activePack.level.unit,
          slideId: currentSlide.id,
          question: currentSlide.question,
          answer: answerText,
          answerGuide: currentSlide.answerGuide ?? [currentSlide.body, ...slideParagraphs].join('\n\n'),
          commandTerm: currentSlide.commandTerm?.term,
        }),
      })
      const data = await response.json().catch(() => null) as { feedback?: AiAnswerFeedback; error?: string } | null
      if (!response.ok || !data?.feedback) {
        throw new Error(data?.error ?? 'Could not check this answer.')
      }
      setAnswerFeedbackBySlide((current) => ({ ...current, [currentSlide.id]: data.feedback }))
    } catch (error) {
      setAnswerFeedbackBySlide((current) => ({
        ...current,
        [currentSlide.id]: {
          verdict: 'partial',
          feedback: error instanceof Error ? error.message : 'Could not check this answer.',
          correction: 'Make sure your answer uses the study-design language, then explains it in your own words.',
          nextStep: 'Add a clearer link to the command term and try checking again.',
        },
      }))
    } finally {
      setCheckingSlideId((current) => current === currentSlide.id ? null : current)
    }
  }

  if (!currentSlide) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/76 px-4 py-6 backdrop-blur-md">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-white/12 bg-[#07090b] shadow-[0_24px_100px_rgba(0,0,0,0.58)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/70">
              {activePack.pack.generatedBy === 'ai' ? 'AI VCE lesson pack' : 'VCE lesson pack'}
            </p>
            <h3 className="mt-1 truncate text-base font-semibold text-white">
              {activePack.course.name} / {activePack.pack.unitTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close unit lesson pack"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-auto lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-b border-white/10 bg-white/[0.025] p-4 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                {slides.length} slides
              </span>
              <span className="rounded-md border border-white/10 bg-black/18 px-2.5 py-1 text-xs font-semibold text-white/45">
                {activePack.pack.generatedBy}
              </span>
            </div>
            <div className="mt-4 max-h-[56vh] space-y-2 overflow-auto pr-1">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setSlideIndex(index)}
                  className={classNames(
                    'flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition',
                    slideIndex === index
                      ? 'border-cyan-300/35 bg-cyan-300/12 text-white'
                      : 'border-white/10 bg-black/18 text-white/52 hover:border-white/20 hover:text-white',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{slide.title}</span>
                    <span className="mt-0.5 block text-[11px] uppercase tracking-[0.1em] text-white/32">{slide.kind} / {slide.minutes} min</span>
                  </span>
                </button>
              ))}
            </div>
            <a
              href={activePack.pack.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/18 px-3 py-2 text-xs font-semibold text-white/55 transition hover:border-white/20 hover:text-white"
            >
              <FileText className="h-3.5 w-3.5" />
              {activePack.pack.sourceTitle}
            </a>
            {activePack.pack.commandTerms.length > 0 && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/18 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/38">Command terms</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activePack.pack.commandTerms.slice(0, 8).map((term) => (
                    <span key={term.term} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-white/58">
                      {term.term}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <section className="min-w-0 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
                {currentSlide.kind}
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-white/45">
                Slide {slideIndex + 1} of {slides.length}
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-white/45">
                {currentSlide.minutes} min
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-normal text-white sm:text-4xl">{currentSlide.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/68">{currentSlide.body}</p>

            {slideParagraphs.length > 0 && (
              <div className="mt-6 max-w-4xl space-y-4 rounded-lg border border-white/10 bg-white/[0.028] p-5">
                {slideParagraphs.map((paragraph, index) => (
                  <p key={`${currentSlide.id}-paragraph-${index}`} className="text-base leading-8 text-white/78">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {currentSlide.bullets.length > 0 && (
              <div className="mt-6 grid gap-3">
                {currentSlide.bullets.map((bullet) => (
                  <div key={bullet} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm leading-6 text-white/72">{bullet}</p>
                  </div>
                ))}
              </div>
            )}

            {(currentSlide.commandTerm || currentSlide.activity || currentSlide.question || currentSlide.answerGuide) && (
              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {currentSlide.commandTerm && (
                  <SlideCallout
                    label={`Command term: ${currentSlide.commandTerm.term}`}
                    value={`${currentSlide.commandTerm.meaning} Response move: ${currentSlide.commandTerm.responseMove}`}
                  />
                )}
                {currentSlide.activity && <SlideCallout label="Activity" value={currentSlide.activity} />}
                {currentSlide.question && <SlideCallout label="Question" value={currentSlide.question} />}
                {currentSlide.answerGuide && <SlideCallout label="Answer guide" value={currentSlide.answerGuide} />}
              </div>
            )}

            {hasAnswerCheck && (
              <div className="mt-6 rounded-lg border border-cyan-300/18 bg-cyan-300/[0.055] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-cyan-100/70">AI answer check</p>
                    <p className="mt-1 text-sm text-white/58">Type your response and the tutor will check it against the slide question.</p>
                  </div>
                  <button
                    type="button"
                    disabled={checkingAnswer || !answerText.trim()}
                    onClick={() => void checkStudentAnswer()}
                    className="inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/12 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkingAnswer ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {checkingAnswer ? 'Checking...' : 'Check answer'}
                  </button>
                </div>
                <textarea
                  value={answerText}
                  onChange={(event) => setAnswerDrafts((current) => ({ ...current, [currentSlide.id]: event.target.value }))}
                  rows={5}
                  placeholder="Write your answer here..."
                  className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-cyan-300/35"
                />
                {answerFeedback && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/24 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={classNames(
                          'rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]',
                          answerFeedback.verdict === 'correct'
                            ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                            : answerFeedback.verdict === 'incorrect'
                              ? 'border-rose-300/30 bg-rose-300/10 text-rose-100'
                              : 'border-amber-300/30 bg-amber-300/10 text-amber-100',
                        )}
                      >
                        {answerFeedback.verdict}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/74">{answerFeedback.feedback}</p>
                    <p className="mt-2 text-sm leading-6 text-white/58">{answerFeedback.correction}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-cyan-100">{answerFeedback.nextStep}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => setSlideIndex((current) => Math.max(0, current - 1))}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </button>
          <div className="flex max-w-[420px] flex-wrap justify-center gap-1.5">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to generated slide ${index + 1}`}
                onClick={() => setSlideIndex(index)}
                className={classNames(
                  'h-2.5 w-2.5 rounded-full transition',
                  slideIndex === index ? 'bg-cyan-200' : 'bg-white/18 hover:bg-white/35',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => setSlideIndex((current) => Math.min(slides.length - 1, current + 1))}
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function AnswerFeedbackPanel({ feedback }: { feedback: AiAnswerFeedback }) {
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/24 p-4">
      <span
        className={classNames(
          'rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]',
          feedback.verdict === 'correct'
            ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
            : feedback.verdict === 'incorrect'
              ? 'border-rose-300/30 bg-rose-300/10 text-rose-100'
              : 'border-amber-300/30 bg-amber-300/10 text-amber-100',
        )}
      >
        {feedback.verdict}
      </span>
      <p className="mt-3 text-sm leading-6 text-white/74">{feedback.feedback}</p>
      <p className="mt-2 text-sm leading-6 text-white/58">{feedback.correction}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-emerald-100">{feedback.nextStep}</p>
    </div>
  )
}

function SlideCallout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/22 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/38">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/72">{value}</p>
    </div>
  )
}
