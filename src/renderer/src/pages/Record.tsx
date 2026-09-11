import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecorder } from '../hooks/useRecorder'
import LevelMeter from '../components/LevelMeter'
import type { AppSettings } from '../types'

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
  const [captureSystemAudio, setCaptureSystemAudio] = useState(true)
  const { isRecording, seconds, level, start, stop, error } = useRecorder()
  const navigate = useNavigate()
  const startedRef = useRef(false)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  const handleStart = async (): Promise<void> => {
    const meeting = await window.api.meetings.create(title || 'Reunião sem título')
    setMeetingId(meeting.id)
    onCreated()
    startedRef.current = true
    await start({ micDeviceId: settings?.micDeviceId || undefined, captureSystemAudio })
  }

  const handleStop = async (): Promise<void> => {
    if (!meetingId) return
    const result = await stop()
    if (!result) return
    await window.api.meetings.saveAudio(meetingId, result.buffer, result.durationSeconds)
    navigate(`/meeting/${meetingId}`)
    window.api.meetings.processRecording(meetingId).catch((e) => console.error(e))
    onCreated()
  }

  if (!isRecording) {
    return (
      <div className="center-state">
        <p className="eyebrow" style={{ margin: 0 }}>
          Nova gravação
        </p>
        <h1 className="page-title">Antes de começar</h1>

        <div className="field">
          <label>Título da reunião</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Alinhamento semanal — squad Produto"
          />
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={captureSystemAudio}
              onChange={(e) => setCaptureSystemAudio(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Capturar também o áudio do sistema (outros participantes na chamada)
          </label>
          <span className="hint">
            No macOS é necessário conceder permissão de Gravação de Tela ao app na primeira vez.
          </span>
        </div>

        {error && <p style={{ color: 'var(--clay-deep)', fontSize: '13px' }}>{error}</p>}

        <button className="btn btn-record" onClick={handleStart}>
          ● Começar a gravar
        </button>
      </div>
    )
  }

  return (
    <div className="center-state">
      <div className="row">
        <span className="mic-dot" />
        <p className="eyebrow" style={{ margin: 0 }}>
          Gravando
        </p>
      </div>
      <div className="record-timer">{formatTime(seconds)}</div>
      <LevelMeter level={level} />
      <p className="subtitle" style={{ margin: 0 }}>
        {title || 'Reunião sem título'}
      </p>
      <button className="btn btn-primary" onClick={handleStop}>
        ■ Encerrar e transcrever
      </button>
    </div>
  )
}
