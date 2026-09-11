import { app, shell, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import {
  createMeeting,
  updateMeeting,
  getMeeting,
  listMeetings,
  deleteMeeting,
  audioDir,
  type Meeting
} from './db'
import { transcribeAudio } from './transcription'
import { generateMeetingNotes, getNoteTraceability } from './notesAI'
import { settingsStore, type AppSettings } from './store'
import { NOTE_TEMPLATES } from '../shared/templates'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    titleBarStyle: 'hiddenInset',
    icon: join(app.getAppPath(), 'resources', 'icon.png'),
    backgroundColor: '#f2efe8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpcHandlers(): void {
  ipcMain.handle('meetings:list', () => listMeetings())

  ipcMain.handle('meetings:get', (_e, id: string) => getMeeting(id))

  ipcMain.handle('meetings:delete', (_e, id: string) => {
    deleteMeeting(id)
    return true
  })

  ipcMain.handle('meetings:rename', (_e, id: string, title: string) => {
    updateMeeting(id, { title })
    return getMeeting(id)
  })

  ipcMain.handle('meetings:updateNotes', (_e, id: string, notesMarkdown: string) => {
    updateMeeting(id, { notesMarkdown })
    return getMeeting(id)
  })

  ipcMain.handle('meetings:updateUserNotes', (_e, id: string, userNotes: string) => {
    updateMeeting(id, { userNotes })
    return getMeeting(id)
  })

  ipcMain.handle('meetings:create', (_e, title: string, templateId?: string) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    const meeting: Meeting = {
      id,
      title: title || 'Untitled meeting',
      createdAt: now,
      updatedAt: now,
      durationSeconds: 0,
      audioPath: null,
      transcript: null,
      notesMarkdown: null,
      status: 'recording',
      errorMessage: null,
      templateId: templateId || settingsStore.get('defaultTemplateId')
    }
    createMeeting(meeting)
    return meeting
  })

  ipcMain.handle(
    'meetings:saveAudio',
    async (_e, id: string, buffer: ArrayBuffer, durationSeconds: number) => {
      const filePath = join(audioDir, `${id}.webm`)
      await writeFile(filePath, Buffer.from(buffer))
      updateMeeting(id, { audioPath: filePath, durationSeconds, status: 'transcribing' })
      return getMeeting(id)
    }
  )

  ipcMain.handle('meetings:processRecording', async (event, id: string) => {
    const meeting = getMeeting(id)
    if (!meeting || !meeting.audioPath) {
      throw new Error('Meeting audio not found.')
    }

    const send = (message: string): void => {
      event.sender.send('meetings:progress', { id, message })
    }

    try {
      updateMeeting(id, { status: 'transcribing' })
      send('Transcribing audio locally with Whisper…')
      const transcript = await transcribeAudio(meeting.audioPath, send)
      updateMeeting(id, { transcript, status: 'generating_notes' })

      send('Writing structured notes with AI…')
      // Re-read the meeting: the jottings may have been saved during the
      // recording, after the snapshot this handler opened with.
      const current = getMeeting(id)
      const notesMarkdown = await generateMeetingNotes(
        transcript,
        current?.templateId,
        current?.userNotes
      )
      updateMeeting(id, { notesMarkdown, status: 'ready' })

      return getMeeting(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      updateMeeting(id, { status: 'error', errorMessage: message })
      throw err
    }
  })

  ipcMain.handle('meetings:regenerateNotes', async (_e, id: string, templateId?: string) => {
    const meeting = getMeeting(id)
    if (!meeting || !meeting.transcript) {
      throw new Error('No transcript available for this meeting.')
    }
    const nextTemplateId = templateId ?? meeting.templateId
    updateMeeting(id, { status: 'generating_notes', templateId: nextTemplateId })
    try {
      const notesMarkdown = await generateMeetingNotes(
        meeting.transcript,
        nextTemplateId,
        meeting.userNotes
      )
      updateMeeting(id, { notesMarkdown, status: 'ready' })
      return getMeeting(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      updateMeeting(id, { status: 'error', errorMessage: message })
      throw err
    }
  })

  ipcMain.handle('meetings:noteTraceability', (_e, id: string) => {
    const meeting = getMeeting(id)
    if (!meeting?.notesMarkdown || !meeting.transcript) {
      return { total: 0, untraceable: [], fromUserNotes: [] }
    }
    return getNoteTraceability(
      meeting.notesMarkdown,
      meeting.transcript,
      meeting.templateId,
      meeting.userNotes
    )
  })

  ipcMain.handle('templates:list', () => NOTE_TEMPLATES)

  ipcMain.handle('audio:listDesktopSources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources.map((s) => ({ id: s.id, name: s.name }))
  })

  ipcMain.handle('settings:get', () => settingsStore.store)

  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    for (const [key, value] of Object.entries(patch)) {
      settingsStore.set(key as keyof AppSettings, value as never)
    }
    return settingsStore.store
  })
}
