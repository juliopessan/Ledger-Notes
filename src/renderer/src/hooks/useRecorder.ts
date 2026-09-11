import { useCallback, useRef, useState } from 'react'

interface UseRecorderResult {
  isRecording: boolean
  seconds: number
  /** RMS level of the captured signal, 0–1. A real measurement of the audio
   *  coming in — the UI uses it to show that sound is actually arriving. */
  level: number
  start: (opts: { micDeviceId?: string; captureSystemAudio: boolean }) => Promise<void>
  stop: () => Promise<{ buffer: ArrayBuffer; durationSeconds: number } | null>
  error: string | null
}

export function useRecorder(): UseRecorderResult {
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamsRef = useRef<MediaStream[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)

  const start = useCallback(
    async (opts: { micDeviceId?: string; captureSystemAudio: boolean }) => {
      setError(null)
      chunksRef.current = []
      streamsRef.current = []

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: opts.micDeviceId ? { deviceId: { exact: opts.micDeviceId } } : true
        })
        streamsRef.current.push(micStream)

        const audioCtx = new AudioContext()
        audioContextRef.current = audioCtx
        const destination = audioCtx.createMediaStreamDestination()

        audioCtx.createMediaStreamSource(micStream).connect(destination)

        if (opts.captureSystemAudio) {
          try {
            const sources = await window.api.audio.listDesktopSources()
            const primary = sources[0]
            if (primary) {
              const systemStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  mandatory: {
                    chromeMediaSource: 'desktop'
                  }
                } as unknown as MediaTrackConstraints,
                video: {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: primary.id,
                    maxWidth: 1,
                    maxHeight: 1
                  }
                } as unknown as MediaTrackConstraints
              })
              systemStream.getVideoTracks().forEach((t) => t.stop())
              const audioOnlyTracks = systemStream.getAudioTracks()
              if (audioOnlyTracks.length > 0) {
                streamsRef.current.push(systemStream)
                audioCtx.createMediaStreamSource(new MediaStream(audioOnlyTracks)).connect(destination)
              }
            }
          } catch (sysErr) {
            console.warn('Could not capture system audio:', sysErr)
          }
        }

        const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.start(1000)
        mediaRecorderRef.current = recorder

        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 1024
        if (destination.stream.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(destination.stream).connect(analyser)
        }
        const samples = new Float32Array(analyser.fftSize)

        const readLevel = (): void => {
          analyser.getFloatTimeDomainData(samples)
          let sum = 0
          for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
          const rms = Math.sqrt(sum / samples.length)
          setLevel(Math.min(1, rms * 4))
          rafRef.current = requestAnimationFrame(readLevel)
        }
        rafRef.current = requestAnimationFrame(readLevel)

        startedAtRef.current = Date.now()
        setSeconds(0)
        timerRef.current = setInterval(() => {
          setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
        }, 500)

        setIsRecording(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        throw err
      }
    },
    []
  )

  const stop = useCallback(async (): Promise<{ buffer: ArrayBuffer; durationSeconds: number } | null> => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return null

    const durationSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000)

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })
    recorder.stop()
    await stopped

    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    streamsRef.current = []
    await audioContextRef.current?.close()
    audioContextRef.current = null

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setLevel(0)
    setIsRecording(false)

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    chunksRef.current = []
    const buffer = await blob.arrayBuffer()

    return { buffer, durationSeconds }
  }, [])

  return { isRecording, seconds, level, start, stop, error }
}
