import { useEffect, useState } from 'react'
import type { AppSettings } from '../types'
import type { NoteTemplate } from '../../../shared/templates'

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.templates.list().then(setTemplates)
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
      <p className="eyebrow">Settings</p>
      <h1 className="page-title">
        Your keys, <span className="voice">your choice of provider.</span>
      </h1>
      <p className="subtitle">
        Transcription runs fully locally with Whisper. The structured notes use whichever AI you
        configure below — the key never leaves your computer.
      </p>

      <div className="field">
        <label>AI provider for notes</label>
        <select
          value={settings.aiProvider}
          onChange={(e) => update({ aiProvider: e.target.value as AppSettings['aiProvider'] })}
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT)</option>
        </select>
      </div>

      <div className="field">
        <label>Anthropic API key</label>
        <input
          type="password"
          value={settings.anthropicApiKey}
          onChange={(e) => update({ anthropicApiKey: e.target.value })}
          placeholder="sk-ant-..."
        />
        <span className="hint">console.anthropic.com/settings/keys</span>
      </div>

      <div className="field">
        <label>Anthropic model</label>
        <input
          value={settings.anthropicModel}
          onChange={(e) => update({ anthropicModel: e.target.value })}
        />
      </div>

      <div className="field">
        <label>OpenAI API key</label>
        <input
          type="password"
          value={settings.openaiApiKey}
          onChange={(e) => update({ openaiApiKey: e.target.value })}
          placeholder="sk-..."
        />
        <span className="hint">platform.openai.com/api-keys</span>
      </div>

      <div className="field">
        <label>OpenAI model</label>
        <input value={settings.openaiModel} onChange={(e) => update({ openaiModel: e.target.value })} />
      </div>

      <div className="field">
        <label>Default note template</label>
        <select
          value={settings.defaultTemplateId}
          onChange={(e) => update({ defaultTemplateId: e.target.value })}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="hint">
          Applied to new recordings. You can switch it when recording, or later, by regenerating
          the notes of a meeting that is already transcribed.
        </span>
      </div>

      <div className="field">
        <label>Whisper model (local transcription)</label>
        <select
          value={settings.whisperModel}
          onChange={(e) => update({ whisperModel: e.target.value as AppSettings['whisperModel'] })}
        >
          <option value="tiny">tiny — fastest, least accurate</option>
          <option value="base">base</option>
          <option value="small">small — good balance (recommended)</option>
          <option value="medium">medium</option>
          <option value="large-v3">large-v3 — most accurate, slowest</option>
        </select>
        <span className="hint">
          The model downloads automatically on the first transcription (this can take a few minutes).
        </span>
      </div>

      <div className="field">
        <label>Transcription language</label>
        <select
          value={settings.whisperLanguage}
          onChange={(e) => update({ whisperLanguage: e.target.value as AppSettings['whisperLanguage'] })}
        >
          <option value="auto">Detect automatically</option>
          <option value="pt">Portuguese</option>
          <option value="en">English</option>
        </select>
        <span className="hint">
          Forcing the language sharpens the transcript when your meetings are always in the same one.
        </span>
      </div>

      <div className="field">
        <label>Python path (optional)</label>
        <input
          value={settings.pythonPath}
          onChange={(e) => update({ pythonPath: e.target.value })}
          placeholder="/opt/homebrew/bin/python3"
        />
        <span className="hint">
          Leave empty for automatic detection. Use this if Whisper cannot be found — it must be a
          Python 3 with faster-whisper installed.
        </span>
      </div>

      <div className="row">
        <button className="btn btn-primary" onClick={handleSave}>
          Save settings
        </button>
        {saved && (
          <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: '12.5px' }}>
            ✓ Saved
          </span>
        )}
      </div>
    </div>
  )
}
