import { useNavigate } from 'react-router-dom'

export default function Home(): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="center-state">
      <p className="eyebrow" style={{ margin: 0 }}>
        Ledger Notes
      </p>
      <h1 className="page-title" style={{ maxWidth: '560px' }}>
        A recorded meeting is <span className="voice">memory, not interpretation.</span>
      </h1>
      <p className="subtitle" style={{ margin: 0 }}>
        Record, transcribe locally with Whisper, and get structured notes — without the audio ever
        leaving your machine.
      </p>
      <button className="btn btn-record" onClick={() => navigate('/record')}>
        ● Start recording
      </button>
    </div>
  )
}
