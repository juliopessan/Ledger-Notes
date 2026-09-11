import { useEffect, useState } from 'react'

export const TRANSCRIBING_VERBS = [
  'Decodificando o áudio',
  'Carregando o modelo Whisper',
  'Transcrevendo a fala',
  'Alinhando os segmentos'
]

export const NOTES_VERBS = [
  'Lendo a transcrição',
  'Separando decisões',
  'Separando ações',
  'Checando rastreabilidade'
]

interface ProcessLineProps {
  verbs: string[]
  /** Mensagem real emitida pelo processo principal. Quando existe, ela manda:
   *  é o que está de fato acontecendo, e não a rotação decorativa. */
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
  const [verbIndex, setVerbIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (message) return undefined
    const interval = setInterval(() => {
      setVerbIndex((i) => (i + 1) % verbs.length)
    }, 2400)
    return () => clearInterval(interval)
  }, [verbs.length, message])

  useEffect(() => {
    if (!startedAt) return undefined
    const tick = (): void => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const label = message ?? verbs[verbIndex]

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
