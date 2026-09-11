export interface Meeting {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  durationSeconds: number
  audioPath: string | null
  transcript: string | null
  notesMarkdown: string | null
  status: 'recording' | 'transcribing' | 'generating_notes' | 'ready' | 'error'
  errorMessage: string | null
}

export interface NoteTraceability {
  total: number
  untraceable: string[]
}

export interface AppSettings {
  aiProvider: 'anthropic' | 'openai'
  anthropicApiKey: string
  openaiApiKey: string
  anthropicModel: string
  openaiModel: string
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3'
  whisperLanguage: 'auto' | 'pt' | 'en'
  micDeviceId: string
  systemAudioDeviceId: string
}
