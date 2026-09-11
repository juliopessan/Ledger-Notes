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
  /** Template used to structure the notes. Absent on older meetings. */
  templateId?: string
  /** What the person typed during the meeting. Preserved verbatim: it is
   *  their record, and the AI never overwrites it. */
  userNotes?: string | null
}

export interface NoteTraceability {
  total: number
  /** Items with no support in the transcript or in the person's jottings. */
  untraceable: string[]
  /** Items that came from what the person typed rather than what was said.
   *  Not errors — human assertions, and they deserve their own label. */
  fromUserNotes: string[]
}

export interface AppSettings {
  aiProvider: 'anthropic' | 'openai'
  anthropicApiKey: string
  openaiApiKey: string
  anthropicModel: string
  openaiModel: string
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3'
  whisperLanguage: 'auto' | 'pt' | 'en'
  /** Template applied by default to new recordings. */
  defaultTemplateId: string
  /** Optional path to a Python 3 with faster-whisper installed. Empty = auto-detect. */
  pythonPath: string
  micDeviceId: string
  systemAudioDeviceId: string
}
