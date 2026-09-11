import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Meeting, NoteTraceability } from '../types'
import ProcessLine, { TRANSCRIBING_VERBS, NOTES_VERBS } from '../components/ProcessLine'

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

const statusMessage: Record<Meeting['status'], string> = {
  recording: 'Gravando...',
  transcribing: 'Transcrevendo áudio localmente com Whisper...',
  generating_notes: 'Gerando notas estruturadas com IA...',
  ready: 'Pronta',
  error: 'Erro no processamento'
}

export default function MeetingDetail({ onChanged }: { onChanged: () => void }): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [tab, setTab] = useState<'notes' | 'transcript'>('notes')
  const [notesDraft, setNotesDraft] = useState('')
  const [traceability, setTraceability] = useState<NoteTraceability>({ total: 0, untraceable: [] })
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [processingSince, setProcessingSince] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const m = await window.api.meetings.get(id)
    if (m) {
      setMeeting(m)
      setNotesDraft(m.notesMarkdown ?? '')
      if (m.status === 'ready') {
        const t = await window.api.meetings.noteTraceability(id)
        setTraceability(t)
      }
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const unsubscribe = window.api.meetings.onProgress((data) => {
      if (data.id === id) setProgressMsg(data.message)
    })
    return unsubscribe
  }, [id])

  useEffect(() => {
    if (!meeting) return
    if (meeting.status === 'transcribing' || meeting.status === 'generating_notes') {
      setProcessingSince((since) => since ?? Date.now())
      const interval = setInterval(load, 2000)
      return () => clearInterval(interval)
    }
    setProcessingSince(null)
    return undefined
  }, [meeting, load])

  const handleSaveNotes = async (): Promise<void> => {
    if (!id) return
    setSaving(true)
    await window.api.meetings.updateNotes(id, notesDraft)
    setSaving(false)
    onChanged()
  }

  const handleRegenerate = async (): Promise<void> => {
    if (!id) return
    setProgressMsg('Regenerando notas...')
    const m = await window.api.meetings.regenerateNotes(id)
    setMeeting(m)
    setNotesDraft(m.notesMarkdown ?? '')
    setProgressMsg(null)
    const t = await window.api.meetings.noteTraceability(id)
    setTraceability(t)
    onChanged()
  }

  const handleDelete = async (): Promise<void> => {
    if (!id) return
    if (!confirm('Excluir esta reunião e todos os dados associados?')) return
    await window.api.meetings.delete(id)
    onChanged()
    navigate('/')
  }

  if (!meeting) return <div className="main-inner" />

  const wordCount = meeting.transcript
    ? meeting.transcript.trim().split(/\s+/).filter(Boolean).length
    : 0
  const isProcessing = meeting.status === 'transcribing' || meeting.status === 'generating_notes'
  const { total: totalClaims, untraceable } = traceability
  const tracedCount = totalClaims - untraceable.length
  const tracedPct = totalClaims > 0 ? Math.round((tracedCount / totalClaims) * 100) : 0
  const liveStateClass = isProcessing
    ? 'is-working'
    : meeting.status === 'error'
      ? 'is-error'
      : meeting.status === 'ready'
        ? 'is-ready'
        : ''

  return (
    <div className="main-inner">
      <p className="eyebrow">Reunião</p>
      <h1 className="page-title">{meeting.title}</h1>
      <p className="subtitle">
        {new Date(meeting.createdAt).toLocaleString('pt-BR')} —{' '}
        <span className="voice">o que ficou registrado, não o que deveria ter sido dito.</span>
      </p>

      <div className={`ledger ${isProcessing ? 'is-working' : ''}`}>
        <div className="ledger-head">
          <span className={`live ${liveStateClass}`}>{statusMessage[meeting.status]}</span>
          <span className="meta">whisper local · transcrição + notas por IA</span>
        </div>

        {meeting.status === 'ready' && totalClaims > 0 && (
          <>
            <div className="bar-row">
              <div className="bar-label">
                <span>Decisões e ações geradas</span>
                <b>{totalClaims.toString().padStart(2, '0')}</b>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: '100%', background: 'var(--clay)' }} />
              </div>
            </div>
            <div className="bar-row">
              <div className="bar-label">
                <span>Rastreadas à transcrição</span>
                <b>{tracedCount.toString().padStart(2, '0')}</b>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${tracedPct}%`, background: 'var(--ledger-mint)' }}
                />
              </div>
            </div>
          </>
        )}

        <div className="figs">
          <div className="fig">
            <b>{formatDuration(meeting.durationSeconds)}</b>
            <span>duração gravada</span>
          </div>
          <div className="fig">
            <b>{wordCount.toString().padStart(2, '0')}</b>
            <span>palavras transcritas</span>
          </div>
          <div className="fig">
            <b>{meeting.status === 'ready' ? '100%' : '—'}</b>
            <span>processamento</span>
          </div>
        </div>

        {meeting.status === 'ready' && meeting.transcript && (
          <div className="measured">
            <span className="tick" aria-hidden="true">
              ✓
            </span>
            <p>
              <span className="k">Medido, não estimado</span>
              A transcrição acima foi gerada localmente pelo Whisper a partir do áudio gravado.
              Reabra o áudio em {meeting.audioPath?.split('/').slice(-2).join('/')} para conferir.
            </p>
          </div>
        )}

        {isProcessing && (
          <ProcessLine
            verbs={meeting.status === 'transcribing' ? TRANSCRIBING_VERBS : NOTES_VERBS}
            message={progressMsg}
            startedAt={processingSince ?? undefined}
          />
        )}

        {meeting.status === 'error' && meeting.errorMessage && (
          <p style={{ color: 'var(--clay)', fontFamily: 'var(--mono)', fontSize: '12.5px' }}>
            {meeting.errorMessage}
          </p>
        )}
      </div>

      {untraceable.length > 0 && (
        <div className="flag">
          <span className="flag-k">Não rastreável à transcrição</span>
          <p>
            Os itens abaixo aparecem nas notas geradas, mas não foram encontrados com confiança na
            transcrição. Trate-os como não confirmados até revisar o áudio original:
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
            {untraceable.map((claim, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
                {claim}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'notes' ? 'active' : ''}`} onClick={() => setTab('notes')}>
          Notas
        </button>
        <button
          className={`tab ${tab === 'transcript' ? 'active' : ''}`}
          onClick={() => setTab('transcript')}
        >
          Transcrição
        </button>
      </div>

      {tab === 'notes' ? (
        <>
          <textarea
            className="notes-editor"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={isProcessing ? 'Gerando notas...' : 'Notas aparecerão aqui.'}
          />
          <div className="row" style={{ marginTop: '14px' }}>
            <button className="btn btn-primary" onClick={handleSaveNotes} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar notas'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleRegenerate}
              disabled={!meeting.transcript || isProcessing}
            >
              Regenerar notas
            </button>
            <button className="btn btn-ghost" onClick={handleDelete} style={{ marginLeft: 'auto' }}>
              Excluir reunião
            </button>
          </div>
        </>
      ) : (
        <div className="transcript-box">
          {meeting.transcript || (isProcessing ? 'Transcrevendo...' : 'Sem transcrição ainda.')}
        </div>
      )}
    </div>
  )
}
