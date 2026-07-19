'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FilePlus2, LoaderCircle, Mic, Pause, Play, RotateCcw, Square } from 'lucide-react'
import { AiMarkdown } from '@/components/ai-markdown'
import { apiUrl } from '@/lib/api-client'
import { formatAiTextForDocument } from '@/lib/documents/format-ai-text'
import type { NoticeTone } from '@/components/airnexus-app'
import { cn } from '@/lib/utils'

/**
 * Standalone lesson recorder — split out from Documents so recording a
 * lesson isn't tangled up with editing a specific document. Records,
 * transcribes, and drafts notes here; saving hands off to Documents as a
 * fresh document rather than silently mutating whatever doc happened to be
 * open.
 */

type RecordState = 'idle' | 'recording' | 'paused' | 'processing' | 'done'

const MAX_RECORDING_SECONDS = 20 * 60

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

type LessonRecorderPageProps = {
  onNavigate: (section: string) => void
  notify: (message: string, tone?: NoticeTone) => void
}

export function LessonRecorderPage({ onNavigate, notify }: LessonRecorderPageProps) {
  const [state, setState] = useState<RecordState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedToDocuments, setSavedToDocuments] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<number | null>(null)

  // Never leave the microphone hot if the page changes mid-recording.
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const generateNotesFromTranscript = async (transcript: string) => {
    const response = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Turn this lesson recording transcript into clear, structured study notes:\n\n${transcript.slice(0, 20_000)}`,
        mode: 'auto',
        action: 'notes',
        purpose: 'study-generation',
        history: [],
        documents: [],
      }),
    })
    const data = await response.json().catch(() => ({})) as { reply?: string; error?: string }
    if (!response.ok || !data.reply) throw new Error(data.error || 'Could not generate notes')
    return data.reply
  }

  const processRecording = async (blob: Blob) => {
    setState('processing')
    setError('')
    try {
      const body = new FormData()
      body.set('file', blob, 'lesson-recording.webm')
      const transcribeResponse = await fetch(apiUrl('/api/transcribe'), { method: 'POST', body })
      const transcribeData = await transcribeResponse.json().catch(() => ({})) as { text?: string; error?: string }
      if (!transcribeResponse.ok || !transcribeData.text) throw new Error(transcribeData.error || 'Could not transcribe the recording')
      const generated = await generateNotesFromTranscript(transcribeData.text)
      setNotes(generated)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the recording')
      setState('idle')
    }
  }

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        void processRecording(blob)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setSeconds(0)
      setState('recording')
      timerRef.current = window.setInterval(() => {
        setSeconds((current) => {
          const next = current + 1
          if (next >= MAX_RECORDING_SECONDS) mediaRecorderRef.current?.stop()
          return next
        })
      }, 1000)
    } catch {
      setError('Microphone access could not be started. Check your browser permissions and try again.')
    }
  }

  const togglePause = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      setState('paused')
      if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null }
    } else if (recorder.state === 'paused') {
      recorder.resume()
      setState('recording')
      timerRef.current = window.setInterval(() => setSeconds((current) => current + 1), 1000)
    }
  }

  const stopRecording = () => {
    if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null }
    mediaRecorderRef.current?.stop()
  }

  const recordAnother = () => {
    setState('idle')
    setSeconds(0)
    setNotes('')
    setError('')
    setSavedToDocuments(false)
  }

  const downloadNotes = () => {
    const url = URL.createObjectURL(new Blob([notes], { type: 'text/markdown' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `lesson-notes-${new Date().toISOString().slice(0, 10)}.md`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('Notes downloaded', 'success')
  }

  const saveToDocuments = async () => {
    setSaving(true)
    try {
      const createResponse = await fetch('/api/docs', { method: 'POST', credentials: 'include' })
      const created = await createResponse.json().catch(() => ({})) as { id?: string; error?: string }
      if (!createResponse.ok || !created.id) throw new Error(created.error ?? 'Could not create a document.')
      const title = `Lesson notes — ${new Date().toLocaleDateString()}`
      const body = formatAiTextForDocument(notes)
      const patchResponse = await fetch(`/api/docs/${created.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
      if (!patchResponse.ok) {
        const data = await patchResponse.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Could not save notes to the document.')
      }
      setSavedToDocuments(true)
      notify('Notes saved to a new document', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save notes.', 'warning')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300/80">Capture &amp; recall</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Record Lesson</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Record a class or study session — AirGPT transcribes it and writes structured notes for you.</p>
      </div>

      {state === 'done' ? (
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Your notes</h3>
            <div className="mt-4 text-sm leading-7 text-slate-200">
              <AiMarkdown>{notes}</AiMarkdown>
            </div>
          </section>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void saveToDocuments()} disabled={saving || savedToDocuments} className="primary-action disabled:cursor-not-allowed disabled:opacity-60">
              <FilePlus2 className="size-4" />{savedToDocuments ? 'Saved to Documents' : saving ? 'Saving…' : 'Save to Documents'}
            </button>
            {savedToDocuments && (
              <button type="button" onClick={() => onNavigate('Documents')} className="secondary-action">
                Open in Documents
              </button>
            )}
            <button type="button" onClick={downloadNotes} className="secondary-action">
              <Download className="size-4" />Download
            </button>
            <button type="button" onClick={recordAnother} className="secondary-action">
              <RotateCcw className="size-4" />Record another
            </button>
          </div>
        </div>
      ) : (
        <section className="glass mx-auto max-w-xl rounded-[2rem] p-8 text-center">
          {state === 'processing' ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <LoaderCircle className="size-6 animate-spin text-zinc-300" />
              <p className="text-sm text-slate-400">Transcribing and writing your notes…</p>
            </div>
          ) : error ? (
            <div className="py-4">
              <p className="text-sm text-rose-300">{error}</p>
              <button type="button" onClick={() => setError('')} className="secondary-action mx-auto mt-4">Try again</button>
            </div>
          ) : (
            <>
              <div className="relative mx-auto flex size-20 items-center justify-center">
                {state === 'recording' && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/20" />}
                <span className={cn('relative flex size-20 items-center justify-center rounded-full', state === 'recording' ? 'bg-rose-500/15 text-rose-300' : 'bg-white/10 text-white')}>
                  <Mic className="size-8" />
                </span>
              </div>
              <p className="mt-6 font-mono text-4xl font-bold tracking-tight text-white">{formatDuration(seconds)}</p>
              <p className="mt-2 text-sm text-slate-500">
                {state === 'idle' ? 'Ready to record — keep this tab open while you record your lesson.' : state === 'paused' ? 'Paused' : 'Recording…'}
              </p>
              <div className="mt-7 flex justify-center gap-3">
                {state === 'idle' ? (
                  <button type="button" onClick={() => void startRecording()} className="primary-action px-6">
                    <Mic className="size-4" />Start recording
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={togglePause} className="secondary-action">
                      {state === 'paused' ? <><Play className="size-4" />Resume</> : <><Pause className="size-4" />Pause</>}
                    </button>
                    <button type="button" onClick={stopRecording} className="primary-action">
                      <Square className="size-4" />Stop &amp; take notes
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
