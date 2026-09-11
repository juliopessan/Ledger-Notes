import { app } from 'electron'
import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { settingsStore } from './store'

/**
 * ffmpeg-static reports its binary at a path that runs *through* app.asar once
 * packaged — and an asar archive is a file, not a directory, so spawning it
 * fails with ENOTDIR. electron-builder already copies the binary out to
 * app.asar.unpacked; this just points at the copy. A no-op in dev, where no
 * asar is involved.
 */
function ffmpegBinary(): string {
  return (ffmpegPath as unknown as string).replace('app.asar', 'app.asar.unpacked')
}

function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegBinary()
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

const PY_BIN = process.platform === 'win32' ? 'python.exe' : 'python3'
const PY_SCRIPTS_DIR = process.platform === 'win32' ? 'Scripts' : 'bin'

/**
 * A venv the app owns, inside its own data folder.
 *
 * This is the one that matters for an installed build. The app bundle ships
 * the sidecar script but no venv, and macOS system Pythons are externally
 * managed (PEP 668), so `pip install` into them is refused — which leaves a
 * downloaded .dmg with nowhere to get faster-whisper from. This path gives it
 * a stable home that survives app updates.
 */
export function appVenvPython(): string {
  return join(app.getPath('userData'), 'venv', PY_SCRIPTS_DIR, PY_BIN)
}

/**
 * Resolves the Python interpreter, in order: the path configured in Settings,
 * the app's own venv, a venv beside the script (how the dev checkout works),
 * and finally a system python3 — which will only work if faster-whisper
 * happens to be installed in it.
 */
function resolvePythonBin(): string | null {
  const configured = settingsStore.get('pythonPath')
  if (configured && existsSync(configured)) return configured

  if (existsSync(appVenvPython())) return appVenvPython()

  const venvBin = join(pythonRoot(), '.venv', PY_SCRIPTS_DIR, PY_BIN)
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
        // The interpreter exists but has no faster-whisper. Raw stderr would
        // send an installed user off to a project folder they never cloned, so
        // replace it with the one recipe that works on macOS: a venv the app
        // owns, since system Pythons are externally managed and refuse pip.
        if (stderr.includes('faster-whisper is not installed')) {
          const venvDir = join(app.getPath('userData'), 'venv')
          reject(
            new Error(
              'Whisper is not set up yet. Run these two commands in Terminal, then try again:\n\n' +
                `python3 -m venv "${venvDir}"\n` +
                `"${join(venvDir, PY_SCRIPTS_DIR, 'pip')}" install faster-whisper\n\n` +
                'The app looks there on its own — nothing to configure afterwards.'
            )
          )
          return
        }
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
