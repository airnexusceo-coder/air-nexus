import { cleanTextForSpeech } from '@/lib/voice/clean-text-for-speech'
import { apiUrl } from '@/lib/api-client'

export type OrpheusVoice = string

export type OrpheusSpeechRequest = {
  text: string
  voice?: OrpheusVoice
}

let activeAudio: HTMLAudioElement | null = null
let activeAudioUrl: string | null = null
let activeController: AbortController | null = null
let activePlaybackReject: ((reason: Error) => void) | null = null

function cancellationError() {
  const error = new Error('Speech cancelled.')
  error.name = 'AbortError'
  return error
}

function releaseActiveAudio() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.removeAttribute('src')
    activeAudio.load()
  }
  activeAudio = null
  if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl)
  activeAudioUrl = null
}

export function cancelOrpheusSpeech() {
  activeController?.abort()
  activeController = null
  const rejectPlayback = activePlaybackReject
  activePlaybackReject = null
  releaseActiveAudio()
  rejectPlayback?.(cancellationError())
}

export function isSpeechCancellation(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

async function playGeneratedAudio(text: string, voice: OrpheusVoice | undefined, controller: AbortController) {
  const response = await fetch(apiUrl('/api/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal: controller.signal,
  })

  if (!response.ok) {
    let message = 'Orpheus speech generation failed.'
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // The route may return a non-JSON gateway error.
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  if (controller.signal.aborted) throw cancellationError()
  if (!blob.size) throw new Error('Orpheus returned no audio.')

  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  activeAudio = audio
  activeAudioUrl = url

  try {
    const ended = new Promise<void>((resolve, reject) => {
      const clearHandlers = () => {
        audio.onended = null
        audio.onerror = null
        if (activePlaybackReject === rejectPlayback) activePlaybackReject = null
      }
      const rejectPlayback = (reason: Error) => {
        clearHandlers()
        reject(reason)
      }
      activePlaybackReject = rejectPlayback
      audio.onended = () => {
        clearHandlers()
        resolve()
      }
      audio.onerror = () => rejectPlayback(new Error('This browser could not decode the Orpheus audio.'))
    })
    await audio.play()
    await ended
  } finally {
    if (activeAudio === audio) {
      activePlaybackReject = null
      releaseActiveAudio()
    }
  }
}

export async function speakWithOrpheus(request: OrpheusSpeechRequest | string): Promise<void> {
  const text = cleanTextForSpeech(typeof request === 'string' ? request : request.text)
  const voice = typeof request === 'string' ? undefined : request.voice
  if (!text) throw new Error('There is no response to speak.')

  cancelOrpheusSpeech()
  const controller = new AbortController()
  activeController = controller
  try {
    await playGeneratedAudio(text, voice, controller)
  } catch (error) {
    if (controller.signal.aborted) throw cancellationError()
    throw error
  } finally {
    if (activeController === controller) activeController = null
  }
}
