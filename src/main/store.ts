import Store from 'electron-store'
import type { AppSettings } from '../shared/types'

export type { AppSettings }

const defaults: AppSettings = {
  aiProvider: 'anthropic',
  anthropicApiKey: '',
  openaiApiKey: '',
  anthropicModel: 'claude-sonnet-4-5',
  openaiModel: 'gpt-4o',
  whisperModel: 'small',
  whisperLanguage: 'auto',
  micDeviceId: '',
  systemAudioDeviceId: ''
}

export const settingsStore = new Store<AppSettings>({
  name: 'settings',
  defaults
})
