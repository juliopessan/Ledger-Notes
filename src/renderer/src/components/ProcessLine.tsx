import { useEffect, useState } from 'react'

export const TRANSCRIBING_VERBS = [
  'Decoding the audio',
  'Loading the Whisper model',
  'Transcribing speech',
  'Aligning segments'
]

export const NOTES_VERBS = [
  'Reading the transcript',
  'Separating decisions',
  'Separating actions',
  'Checking traceability'
]

interface ProcessLineProps {
  verbs: string[]
  /** The real message emitted by the main process. When a fresh one arrives it
   *  is shown immediately — it is what is actually happening, not a guess.
   *  Between real messages, which can be minutes apart on a long transcription,
   *  the decorative rotation resumes so the view still reads as alive. */
  message?: string | null
  startedAt?: number
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function ProcessLine({ verbs, message, startedAt }: ProcessLineProps): JSX.Element {
  const [label, setLabel] = useState(message || verbs[0])
  const [elapsed, setElapsed] = useState(0)

  // A new real message wins immediately and resets the decorative cycle so
  // the rotation always starts counting from the actual last known step.
  useEffect(() => {
    if (message) setLabel(message)
  }, [message])

  useEffect(() => {
    let i = -1
    const interval = setInterval(() => {
      i = (i + 1) % verbs.length
      setLabel(verbs[i])
    }, 2400)
    return () => clearInterval(interval)
  }, [verbs, message])

  useEffect(() => {
    if (!startedAt) return undefined
    const tick = (): void => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <p className="process-line">
      <span className="spinner" aria-hidden="true" />
      <span className="process-verb" key={label}>
        {label}
      </span>
      {startedAt && <span className="process-elapsed">{formatElapsed(elapsed)}</span>}
    </p>
  )
}
