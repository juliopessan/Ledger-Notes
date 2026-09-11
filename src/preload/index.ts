import { contextBridge, ipcRenderer } from 'electron'
import type { Meeting, AppSettings, NoteTraceability } from '../shared/types'

const api = {
  meetings: {
    list: (): Promise<Meeting[]> => ipcRenderer.invoke('meetings:list'),
    get: (id: string): Promise<Meeting | undefined> => ipcRenderer.invoke('meetings:get', id),
    create: (title: string): Promise<Meeting> => ipcRenderer.invoke('meetings:create', title),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('meetings:delete', id),
    rename: (id: string, title: string): Promise<Meeting> =>
      ipcRenderer.invoke('meetings:rename', id, title),
    updateNotes: (id: string, notesMarkdown: string): Promise<Meeting> =>
      ipcRenderer.invoke('meetings:updateNotes', id, notesMarkdown),
    saveAudio: (id: string, buffer: ArrayBuffer, durationSeconds: number): Promise<Meeting> =>
      ipcRenderer.invoke('meetings:saveAudio', id, buffer, durationSeconds),
    processRecording: (id: string): Promise<Meeting> =>
      ipcRenderer.invoke('meetings:processRecording', id),
    regenerateNotes: (id: string): Promise<Meeting> =>
      ipcRenderer.invoke('meetings:regenerateNotes', id),
    noteTraceability: (id: string): Promise<NoteTraceability> =>
      ipcRenderer.invoke('meetings:noteTraceability', id),
    onProgress: (callback: (data: { id: string; message: string }) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, data: { id: string; message: string }): void =>
        callback(data)
      ipcRenderer.on('meetings:progress', listener)
      return () => ipcRenderer.removeListener('meetings:progress', listener)
    }
  },
  audio: {
    listDesktopSources: (): Promise<{ id: string; name: string }[]> =>
      ipcRenderer.invoke('audio:listDesktopSources')
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:set', patch)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
