import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecorder } from '../hooks/useRecorder'
import LevelMeter from '../components/LevelMeter'
import type { AppSettings } from '../types'
import type { NoteTemplate } from '../../../shared/templates'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function Record({ onCreated }: { onCreated: () => void }): JSX.Element {
  const [title, setTitle] = useState('')
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [captureSystemAudio, setCaptureSystemAudio] = useState(true)
  const [userNotes, setUserNotes] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const { isRecording, seconds, level, start, stop, error } = useRecorder()
  const navigate = useNavigate()
  const startedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setSettings(s)
      setTemplateId((current) => current || s.defaultTemplateId)
    })
    window.api.templates.list().then(setTemplates)
  }, [])

  const selectedTemplate = templates.find((t) => t.id === templateId)

  // Saves what is being typed shortly after the person stops. Meeting notes
  // cannot depend on ending the recording cleanly: if the app dies mid-call,
  // whatever was already written has to be on disk.
  const handleNotesChange = (value: string): void => {
    setUserNotes(value)
    if (!meetingId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      window.api.meetings
        .updateUserNotes(meetingId, value)
        .then(() => setSavedAt(Date.now()))
        .catch((e) => console.error(e))
    }, 700)
  }

  const handleStart = async (): Promise<void> => {
    const meeting = await window.api.meetings.create(title || 'Untitled meeting', templateId)
    setMeetingId(meeting.id)
    onCreated()
    startedRef.current = true
    await start({ micDeviceId: settings?.micDeviceId || undefined, captureSystemAudio })
  }

  const handleStop = async (): Promise<void> => {
    if (!meetingId) return
    const result = await stop()
    if (!result) return
    // Flush the last typed passage before processing, without waiting on the debounce.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await window.api.meetings.updateUserNotes(meetingId, userNotes)
    await window.api.meetings.saveAudio(meetingId, result.buffer, result.durationSeconds)
    navigate(`/meeting/${meetingId}`)
    window.api.meetings.processRecording(meetingId).catch((e) => console.error(e))
    onCreated()
  }

  if (!isRecording) {
    return (
      <div className="center-state">
        <p className="eyebrow" style={{ margin: 0 }}>
          New recording
        </p>
        <h1 className="page-title">Before you start</h1>

        <div className="field">
          <label>Meeting title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly sync — Product squad"
          />
        </div>

        <div className="field">
          <label>Meeting type</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selectedTemplate && (
            <span className="hint">
              {selectedTemplate.description} Sections:{' '}
              {selectedTemplate.sections.map((s) => s.heading).join(' · ')}
            </span>
          )}
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={captureSystemAudio}
              onChange={(e) => setCaptureSystemAudio(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Also capture system audio (the other participants on the call)
          </label>
          <span className="hint">
            On macOS you have to grant the app Screen Recording permission the first time.
          </span>
        </div>

        {error && <p style={{ color: 'var(--clay-deep)', fontSize: '13px' }}>{error}</p>}

        <button className="btn btn-record" onClick={handleStart}>
          ● Start recording
        </button>
      </div>
    )
  }

  return (
    <div className="recording-view">
      <div className="recording-bar">
        <span className="mic-dot" />
        <span className="recording-clock">{formatTime(seconds)}</span>
        <LevelMeter level={level} />
        <span className="recording-title">{title || 'Untitled meeting'}</span>
        <button className="btn btn-primary" onClick={handleStop}>
          ■ Stop and transcribe
        </button>
      </div>

      <div className="jot-head">
        <p className="eyebrow" style={{ margin: 0 }}>
          Your notes
        </p>
        <span className="jot-status">
          {savedAt ? 'saved' : userNotes ? 'saving…' : 'nothing written yet'}
        </span>
      </div>

      <textarea
        className="jot-editor"
        autoFocus
        value={userNotes}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder={
          'Jot loosely — topics, names, numbers, whatever must not slip.\n\n' +
          'Afterwards the transcript fills in the rest around what you marked here.\n' +
          'This text is kept exactly as you wrote it.'
        }
      />
    </div>
  )
}
