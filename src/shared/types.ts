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
  /** Template usado para estruturar as notas. Ausente em reuniões antigas. */
  templateId?: string
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
  /** Template aplicado por padrão em novas gravações. */
  defaultTemplateId: string
  /** Caminho opcional para um Python 3 com faster-whisper instalado. Vazio = detecção automática. */
  pythonPath: string
  micDeviceId: string
  systemAudioDeviceId: string
}
