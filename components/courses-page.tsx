'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Crown,
  FileText,
  GraduationCap,
  Layers3,
  ListChecks,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react'

import type { NexusPlan } from '@/lib/plans'
import {
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

type NotifyFn = (message: string) => void

type CoursesPageProps = {
  plan: NexusPlan
  notify?: NotifyFn
  onRequestUpgrade: (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => void
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

export function CoursesPage({ plan, notify, onRequestUpgrade }: CoursesPageProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [selectedCourseId, setSelectedCourseId] = useState(VCE_COURSES[0]?.id ?? '')
  const [freeSubjectId, setFreeSubjectId] = useState<string | undefined>()
  const [plusSelection, setPlusSelection] = useState<PlusSelection | undefined>()

  const monthKey = currentCourseMonthKey()
  const monthLabel = useMemo(() => formatMonthKey(monthKey), [monthKey])

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const storedFreeSubjectId = window.localStorage.getItem(FREE_SUBJECT_KEY)
      if (storedFreeSubjectId && VCE_COURSES.some((course) => course.id === storedFreeSubjectId)) {
        setFreeSubjectId(storedFreeSubjectId)
      }

      const storedPlusSelection = window.localStorage.getItem(PLUS_SELECTION_KEY)
      if (!storedPlusSelection) return

      try {
        const parsed = JSON.parse(storedPlusSelection)
        if (isValidPlusSelection(parsed) && VCE_COURSES.some((course) => course.id === parsed.courseId)) {
          setPlusSelection(parsed)
        }
      } catch {
        window.localStorage.removeItem(PLUS_SELECTION_KEY)
      }
    }, 0)

    return () => window.clearTimeout(hydrationTimer)
  }, [])

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

  const selectedAccess = useMemo(
    () =>
      selectedCourse.levels.map((level) => ({
        level,
        access: resolveCourseAccess(plan, selectedCourse.id, level.unit, accessSelection, monthKey),
      })),
    [accessSelection, monthKey, plan, selectedCourse],
  )

  const unlockedUnits = selectedAccess.filter((entry) => entry.access.unlocked).length
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
  }

  const getUnlockedCount = (course: VceCourse) =>
    course.levels.filter((level) => resolveCourseAccess(plan, course.id, level.unit, accessSelection, monthKey).unlocked)
      .length

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
              </div>
            </div>
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
                onUpgrade={(requiredPlan) =>
                  onRequestUpgrade(`${selectedCourse.name} Unit ${level.unit}`, requiredPlan)
                }
              />
            ))}
          </section>
        </main>
      </div>
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
          <ChapterBlock key={chapter.id} chapter={chapter} chapterNumber={index + 1} locked={!unlocked} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs text-white/45">
          {unlocked ? 'Lessons are scaffolded from study-design outcomes, key knowledge and key skills.' : reason}
        </p>
        {unlocked ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Lessons open
          </span>
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
}: {
  chapter: VceCourseChapter
  chapterNumber: number
  locked: boolean
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
      </div>
      <h4 className="mt-2 text-sm font-semibold text-white">{chapter.title}</h4>
      <p className="mt-1 text-xs leading-5 text-white/50">{chapter.outcome}</p>

      <div className="mt-3 grid gap-2">
        {chapter.lessons.map((lesson, index) => (
          <div key={lesson.id} className="rounded-md border border-white/10 bg-black/18 px-3 py-2">
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
            <div className="mt-2 grid gap-1.5">
              {lesson.practice.map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs leading-5 text-white/45">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-200/55" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}