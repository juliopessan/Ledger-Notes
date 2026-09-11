import Store from 'electron-store'
import type { AppSettings } from '../shared/types'
import { DEFAULT_TEMPLATE_ID } from '../shared/templates'

export type { AppSettings }

const defaults: AppSettings = {
  aiProvider: 'anthropic',
  anthropicApiKey: '',
  openaiApiKey: '',
  anthropicModel: 'claude-sonnet-4-5',
  openaiModel: 'gpt-4o',
  whisperModel: 'small',
  whisperLanguage: 'auto',
  defaultTemplateId: DEFAULT_TEMPLATE_ID,
  pythonPath: '',
  micDeviceId: '',
  systemAudioDeviceId: ''
}

export const settingsStore = new Store<AppSettings>({
  name: 'settings',
  defaults
})
