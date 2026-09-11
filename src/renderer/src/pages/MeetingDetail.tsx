import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Meeting, NoteTraceability } from '../types'
import type { NoteTemplate } from '../../../shared/templates'
import ProcessLine, { TRANSCRIBING_VERBS, NOTES_VERBS } from '../components/ProcessLine'

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

const statusMessage: Record<Meeting['status'], string> = {
  recording: 'Recording…',
  transcribing: 'Transcribing audio locally with Whisper…',
  generating_notes: 'Writing structured notes with AI…',
  ready: 'Ready',
  error: 'Processing failed'
}

export default function MeetingDetail({ onChanged }: { onChanged: () => void }): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [tab, setTab] = useState<'notes' | 'transcript' | 'jottings'>('notes')
  const [notesDraft, setNotesDraft] = useState('')
  const [traceability, setTraceability] = useState<NoteTraceability>({
    total: 0,
    untraceable: [],
    fromUserNotes: []
  })
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [processingSince, setProcessingSince] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [templateId, setTemplateId] = useState('')

  useEffect(() => {
    window.api.templates.list().then(setTemplates)
  }, [])

  const load = useCallback(async () => {
    if (!id) return
    const m = await window.api.meetings.get(id)
    if (m) {
      setMeeting(m)
      setNotesDraft(m.notesMarkdown ?? '')
      setTemplateId((current) => current || m.templateId || 'general')
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
    setProgressMsg('Regenerating notes…')
    const m = await window.api.meetings.regenerateNotes(id, templateId)
    setMeeting(m)
    setNotesDraft(m.notesMarkdown ?? '')
    setProgressMsg(null)
    const t = await window.api.meetings.noteTraceability(id)
    setTraceability(t)
    onChanged()
  }

  const handleRetry = async (): Promise<void> => {
    if (!id) return
    setProgressMsg(null)
    setProcessingSince(Date.now())
    setMeeting((m) => (m ? { ...m, status: 'transcribing', errorMessage: null } : m))
    try {
      const m = await window.api.meetings.processRecording(id)
      setMeeting(m)
      setNotesDraft(m.notesMarkdown ?? '')
      const t = await window.api.meetings.noteTraceability(id)
      setTraceability(t)
    } catch {
      // processRecording already recorded the failure on the meeting; reload
      // so the UI shows whatever it actually wrote there.
      await load()
    }
    onChanged()
  }

  const handleDelete = async (): Promise<void> => {
    if (!id) return
    if (!confirm('Delete this meeting and everything stored with it?')) return
    await window.api.meetings.delete(id)
    onChanged()
    navigate('/')
  }

  if (!meeting) return <div className="main-inner" />

  const wordCount = meeting.transcript
    ? meeting.transcript.trim().split(/\s+/).filter(Boolean).length
    : 0
  const isProcessing = meeting.status === 'transcribing' || meeting.status === 'generating_notes'
  const { total: totalClaims, untraceable, fromUserNotes } = traceability
  const tracedCount = totalClaims - untraceable.length - fromUserNotes.length
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
      <p className="eyebrow">Meeting</p>
      <h1 className="page-title">{meeting.title}</h1>
      <p className="subtitle">
        {new Date(meeting.createdAt).toLocaleString('en-GB')} —{' '}
        <span className="voice">what got recorded, not what should have been said.</span>
      </p>

      <div className={`ledger ${isProcessing ? 'is-working' : ''}`}>
        <div className="ledger-head">
          <span className={`live ${liveStateClass}`}>{statusMessage[meeting.status]}</span>
          <span className="meta">local whisper · transcript + AI notes</span>
        </div>

        {meeting.status === 'ready' && totalClaims > 0 && (
          <>
            <div className="bar-row">
              <div className="bar-label">
                <span>Decisions &amp; actions generated</span>
                <b>{totalClaims.toString().padStart(2, '0')}</b>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: '100%', background: 'var(--clay)' }} />
              </div>
            </div>
            <div className="bar-row">
              <div className="bar-label">
                <span>Traced to the transcript</span>
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
            <span>recorded duration</span>
          </div>
          <div className="fig">
            <b>{wordCount.toString().padStart(2, '0')}</b>
            <span>words transcribed</span>
          </div>
          <div className="fig">
            <b>{meeting.status === 'ready' ? '100%' : '—'}</b>
            <span>processed</span>
          </div>
          {fromUserNotes.length > 0 && (
            <div className="fig">
              <b>{fromUserNotes.length.toString().padStart(2, '0')}</b>
              <span>from your own notes</span>
            </div>
          )}
        </div>

        {meeting.status === 'ready' && meeting.transcript && (
          <div className="measured">
            <span className="tick" aria-hidden="true">
              ✓
            </span>
            <p>
              <span className="k">Measured, not estimated</span>
              The transcript above was produced locally by Whisper from the recorded audio.
              Reopen the audio at {meeting.audioPath?.split('/').slice(-2).join('/')} to check it.
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
          <div className="ledger-error">
            <p>{meeting.errorMessage}</p>
            {meeting.audioPath && (
              <div className="row">
                <button className="btn btn-primary" onClick={handleRetry}>
                  Try transcribing again
                </button>
                <span className="ledger-error-note">
                  The recording is still on disk — fixing the cause above and retrying
                  costs nothing.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {untraceable.length > 0 && (
        <div className="flag">
          <span className="flag-k">Not traceable</span>
          <p>
            The items below appear in the generated notes but were not found with confidence in the
            transcript or in your own jottings. Treat them as unconfirmed until you review the
            original audio:
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
          Notes
        </button>
        <button
          className={`tab ${tab === 'transcript' ? 'active' : ''}`}
          onClick={() => setTab('transcript')}
        >
          Transcript
        </button>
        {meeting.userNotes && meeting.userNotes.trim().length > 0 && (
          <button
            className={`tab ${tab === 'jottings' ? 'active' : ''}`}
            onClick={() => setTab('jottings')}
          >
            Your notes
          </button>
        )}
      </div>

      {tab === 'notes' ? (
        <>
          <textarea
            className="notes-editor"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={isProcessing ? 'Writing notes…' : 'Notes will appear here.'}
          />
          <div className="row" style={{ marginTop: '14px' }}>
            <button className="btn btn-primary" onClick={handleSaveNotes} disabled={saving}>
              {saving ? 'Saving…' : 'Save notes'}
            </button>
            <select
              className="template-select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={isProcessing}
              title="Meeting type used to structure the notes"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              onClick={handleRegenerate}
              disabled={!meeting.transcript || isProcessing}
            >
              {templateId !== meeting.templateId ? 'Rewrite with this template' : 'Regenerate notes'}
            </button>
            <button className="btn btn-ghost" onClick={handleDelete} style={{ marginLeft: 'auto' }}>
              Delete meeting
            </button>
          </div>
        </>
      ) : tab === 'transcript' ? (
        <div className="transcript-box">
          {meeting.transcript || (isProcessing ? 'Transcribing…' : 'No transcript yet.')}
        </div>
      ) : (
        <>
          <div className="jottings-box">{meeting.userNotes}</div>
          <p className="hint" style={{ marginTop: '12px' }}>
            What you typed during the meeting, exactly as you wrote it. It anchored the generated
            notes, and is never overwritten by them.
          </p>
        </>
      )}
    </div>
  )
}
