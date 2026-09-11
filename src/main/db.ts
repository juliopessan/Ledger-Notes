import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import type { Meeting } from '../shared/types'

export type { Meeting }

const dataDir = join(app.getPath('userData'), 'data')
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

export const audioDir = join(dataDir, 'audio')
if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true })

const dbFile = join(dataDir, 'meetings.json')

// Armazenamento simples em arquivo JSON (evita dependências nativas compiladas).
// Volume esperado é de dezenas/centenas de reuniões — reescrever o arquivo
// inteiro a cada gravação é aceitável nessa escala.

function readAll(): Record<string, Meeting> {
  if (!existsSync(dbFile)) return {}
  try {
    return JSON.parse(readFileSync(dbFile, 'utf-8')) as Record<string, Meeting>
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, Meeting>): void {
  writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8')
}

export function createMeeting(meeting: Meeting): void {
  const all = readAll()
  all[meeting.id] = meeting
  writeAll(all)
}

export function updateMeeting(id: string, patch: Partial<Meeting>): void {
  const all = readAll()
  const current = all[id]
  if (!current) return
  all[id] = { ...current, ...patch, updatedAt: new Date().toISOString() }
  writeAll(all)
}

export function getMeeting(id: string): Meeting | undefined {
  return readAll()[id]
}

export function listMeetings(): Meeting[] {
  return Object.values(readAll()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function deleteMeeting(id: string): void {
  const all = readAll()
  delete all[id]
  writeAll(all)
}
