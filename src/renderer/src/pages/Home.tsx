import { useNavigate } from 'react-router-dom'

export default function Home(): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="center-state">
      <p className="eyebrow" style={{ margin: 0 }}>
        Ledger Notes
      </p>
      <h1 className="page-title" style={{ maxWidth: '520px' }}>
        Toda reunião gravada é <span className="voice">memória, não interpretação.</span>
      </h1>
      <p className="subtitle" style={{ margin: 0 }}>
        Grave, transcreva localmente com Whisper e gere notas estruturadas — sem que o áudio
        saia da sua máquina.
      </p>
      <button className="btn btn-record" onClick={() => navigate('/record')}>
        ● Iniciar gravação
      </button>
    </div>
  )
}
