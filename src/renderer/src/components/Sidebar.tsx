import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import type { Meeting } from '../types'

const statusLabel: Record<Meeting['status'], string> = {
  recording: 'gravando',
  transcribing: 'transcrevendo',
  generating_notes: 'gerando notas',
  ready: 'pronta',
  error: 'erro'
}

export default function Sidebar({ refreshKey }: { refreshKey: number }): JSX.Element {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    window.api.meetings.list().then(setMeetings)
  }, [refreshKey])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          Ledger Notes
          <small>The AI notepad for back-to-back meetings</small>
        </div>
        <button className="btn btn-record" onClick={() => navigate('/record')}>
          ● Nova gravação
        </button>
      </div>

      <div className="meeting-list">
        {meetings.length === 0 && (
          <p style={{ padding: '10px', color: 'var(--ink-faint)', fontSize: '12.5px' }}>
            Nenhuma reunião ainda.
          </p>
        )}
        {meetings.map((m) => (
          <NavLink
            key={m.id}
            to={`/meeting/${m.id}`}
            className={({ isActive }) => `meeting-item ${isActive ? 'active' : ''}`}
          >
            <span className="title">{m.title}</span>
            <span className="meta">
              <span className={`status-dot ${m.status}`} />
              {new Date(m.createdAt).toLocaleDateString('pt-BR')} · {statusLabel[m.status]}
            </span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-footer">
        <NavLink to="/settings" className="btn btn-ghost" style={{ width: '100%' }}>
          Configurações
        </NavLink>
      </div>
    </aside>
  )
}
