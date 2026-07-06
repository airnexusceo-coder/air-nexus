'use client'

import { useEffect, useRef, useState } from 'react'
import { apiUrl, fetchWithRetry } from '@/lib/api-client'

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string } }>
}

type SpeechRecognitionErrorLike = {
  error?: string
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type UseVoiceInputOptions = {
  onTranscript: (transcript: string) => void
  onError: (message: string) => void
}

export function useVoiceInput({ onTranscript, onError }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimeoutRef = useRef<number | null>(null)
  const transcriptRef = useRef(onTranscript)
  const errorRef = useRef(onError)

  useEffect(() => {
    transcriptRef.current = onTranscript
    errorRef.current = onError
  }, [onError, onTranscript])

  useEffect(() => () => {
    recognitionRef.current?.stop()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current)
  }, [])

  const startWhisperRecording = async () => {
    if (!window.MediaRecorder) {
      errorRef.current('Voice input is not supported in this browser.')
      return
    }
    setIsRequesting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = async () => {
        setIsListening(false)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current)
        const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        const body = new FormData()
        body.set('file', audio, 'voice-input.webm')
        try {
          const response = await fetchWithRetry(apiUrl('/api/transcribe'), { method: 'POST', body })
          const result = await response.json() as { text?: string; error?: string }
          if (!response.ok || !result.text) throw new Error(result.error || 'Voice transcription failed.')
          transcriptRef.current(result.text)
        } catch (error) {
          errorRef.current(error instanceof Error ? error.message : 'Voice transcription failed.')
        } finally {
          setIsRequesting(false)
        }
      }
      recorder.start()
      setIsListening(true)
      recordingTimeoutRef.current = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, 30_000)
    } catch {
      setIsRequesting(false)
      errorRef.current('Microphone access could not be started.')
    }
  }

  const requestMicrophoneAccess = async () => {
    if (!window.isSecureContext) {
      errorRef.current('Microphone access requires HTTPS. Open https://localhost:3000 and try again.')
      return false
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      errorRef.current('Voice input is not supported in this browser.')
      return false
    }

    setIsRequesting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : ''
      if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
        errorRef.current('Microphone access is blocked. In this site’s settings, set Microphone to Allow, then reload AirGPT.')
      } else if (errorName === 'NotFoundError') {
        errorRef.current('No microphone was found. Connect a microphone and try again.')
      } else if (errorName === 'NotReadableError' || errorName === 'AbortError') {
        errorRef.current('The microphone is busy or unavailable. Close other apps using it and try again.')
      } else {
        errorRef.current('Microphone access could not be started.')
      }
      return false
    } finally {
      setIsRequesting(false)
    }
  }

  const toggleListening = async () => {
    if (isRequesting) return
    if (isListening) {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      else recognitionRef.current?.stop()
      return
    }

    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

    if (!Recognition) {
      await startWhisperRecording()
      return
    }
    if (!(await requestMicrophoneAccess())) return

    const recognition = new Recognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-AU'
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ''
      if (transcript) transcriptRef.current(transcript)
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)
    }
    recognition.onerror = (event) => {
      recognitionRef.current = null
      setIsListening(false)
      errorRef.current(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone access is blocked. In this site’s settings, set Microphone to Allow, then reload AirGPT.'
          : 'Voice input could not be started.',
      )
    }

    recognitionRef.current = recognition
    setIsListening(true)
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      errorRef.current('Voice input could not be started.')
    }
  }

  return { isListening, isRequesting, toggleListening }
}