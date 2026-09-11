import { useEffect, useState } from 'react'
import type { AppSettings } from '../types'

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  if (!settings) return <div className="main-inner" />

  const update = (patch: Partial<AppSettings>): void => {
    setSettings({ ...settings, ...patch })
    setSaved(false)
  }

  const handleSave = async (): Promise<void> => {
    await window.api.settings.set(settings)
    setSaved(true)
  }

  return (
    <div className="main-inner">
      <p className="eyebrow">Configurações</p>
      <h1 className="page-title">
        Suas chaves, <span className="voice">sua escolha de provedor.</span>
      </h1>
      <p className="subtitle">
        A transcrição roda 100% local com Whisper. As notas estruturadas usam a IA que você
        configurar abaixo — a chave fica só no seu computador.
      </p>

      <div className="field">
        <label>Provedor de IA para notas</label>
        <select
          value={settings.aiProvider}
          onChange={(e) => update({ aiProvider: e.target.value as AppSettings['aiProvider'] })}
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT)</option>
        </select>
      </div>

      <div className="field">
        <label>Chave de API — Anthropic</label>
        <input
          type="password"
          value={settings.anthropicApiKey}
          onChange={(e) => update({ anthropicApiKey: e.target.value })}
          placeholder="sk-ant-..."
        />
        <span className="hint">console.anthropic.com/settings/keys</span>
      </div>

      <div className="field">
        <label>Modelo Anthropic</label>
        <input
          value={settings.anthropicModel}
          onChange={(e) => update({ anthropicModel: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Chave de API — OpenAI</label>
        <input
          type="password"
          value={settings.openaiApiKey}
          onChange={(e) => update({ openaiApiKey: e.target.value })}
          placeholder="sk-..."
        />
        <span className="hint">platform.openai.com/api-keys</span>
      </div>

      <div className="field">
        <label>Modelo OpenAI</label>
        <input value={settings.openaiModel} onChange={(e) => update({ openaiModel: e.target.value })} />
      </div>

      <div className="field">
        <label>Modelo Whisper (transcrição local)</label>
        <select
          value={settings.whisperModel}
          onChange={(e) => update({ whisperModel: e.target.value as AppSettings['whisperModel'] })}
        >
          <option value="tiny">tiny — mais rápido, menos preciso</option>
          <option value="base">base</option>
          <option value="small">small — bom equilíbrio (recomendado)</option>
          <option value="medium">medium</option>
          <option value="large-v3">large-v3 — mais preciso, mais lento</option>
        </select>
        <span className="hint">
          O modelo é baixado automaticamente na primeira transcrição (pode levar alguns minutos).
        </span>
      </div>

      <div className="field">
        <label>Idioma da transcrição</label>
        <select
          value={settings.whisperLanguage}
          onChange={(e) => update({ whisperLanguage: e.target.value as AppSettings['whisperLanguage'] })}
        >
          <option value="auto">Detectar automaticamente</option>
          <option value="pt">Português</option>
          <option value="en">Inglês</option>
        </select>
        <span className="hint">
          Forçar o idioma deixa a transcrição mais precisa quando a reunião é sempre no mesmo idioma.
        </span>
      </div>

      <div className="field">
        <label>Caminho do Python (opcional)</label>
        <input
          value={settings.pythonPath}
          onChange={(e) => update({ pythonPath: e.target.value })}
          placeholder="/opt/homebrew/bin/python3"
        />
        <span className="hint">
          Deixe vazio para detecção automática. Use isto se o Whisper não for encontrado — precisa
          ser um Python 3 com faster-whisper instalado.
        </span>
      </div>

      <div className="row">
        <button className="btn btn-primary" onClick={handleSave}>
          Salvar configurações
        </button>
        {saved && (
          <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: '12.5px' }}>
            ✓ Salvo
          </span>
        )}
      </div>
    </div>
  )
}
