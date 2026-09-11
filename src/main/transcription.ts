import { app } from 'electron'
import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { settingsStore } from './store'

function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegPath as unknown as string
    const proc = spawn(bin, [
      '-y',
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      outputPath
    ])
    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg failed (code ${code}): ${stderr.slice(-2000)}`))
    })
  })
}

/** Sidecar root: inside the bundle when packaged, in the project folder in dev. */
function pythonRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'python') : join(app.getAppPath(), 'python')
}

/**
 * Resolves the Python interpreter, in order: the path the user configured, a
 * venv next to the script, and finally a system python3 (which still needs
 * faster-whisper installed).
 */
function resolvePythonBin(): string | null {
  const bin = process.platform === 'win32' ? 'python.exe' : 'python3'
  const scriptsDir = process.platform === 'win32' ? 'Scripts' : 'bin'

  const configured = settingsStore.get('pythonPath')
  if (configured && existsSync(configured)) return configured

  const venvBin = join(pythonRoot(), '.venv', scriptsDir, bin)
  if (existsSync(venvBin)) return venvBin

  for (const systemBin of ['/opt/homebrew/bin/python3', '/usr/local/bin/python3', '/usr/bin/python3']) {
    if (existsSync(systemBin)) return systemBin
  }

  return null
}

function runWhisperSidecar(wavPath: string, modelName: string, language: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonBin = resolvePythonBin()
    if (!pythonBin) {
      reject(
        new Error(
          'No Python interpreter found. Install Python 3 and run the Whisper setup ' +
            '(see the README), or point at your Python in Settings.'
        )
      )
      return
    }

    const scriptPath = join(pythonRoot(), 'transcribe.py')
    const proc = spawn(pythonBin, [scriptPath, wavPath, modelName, language])

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Whisper failed (code ${code}): ${stderr.trim().slice(-2000)}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as { text?: string }
        resolve(parsed.text ?? '')
      } catch {
        reject(new Error(`Could not parse Whisper's output: ${stdout.slice(-500)}`))
      }
    })
  })
}

export async function transcribeAudio(
  audioPath: string,
  onProgress?: (message: string) => void
): Promise<string> {
  const wavPath = audioPath.replace(/\.[^.]+$/, '.wav')

  onProgress?.('Converting audio to 16kHz WAV…')
  await convertToWav(audioPath, wavPath)

  const modelName = settingsStore.get('whisperModel') || 'small'
  const language = settingsStore.get('whisperLanguage') || 'auto'

  onProgress?.(`Transcribing with Whisper (${modelName}) via local faster-whisper…`)
  const transcript = await runWhisperSidecar(wavPath, modelName, language)

  await unlink(wavPath).catch(() => {})

  return transcript.trim()
}
