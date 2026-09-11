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
      else reject(new Error(`ffmpeg falhou (código ${code}): ${stderr.slice(-2000)}`))
    })
  })
}

function pythonVenvPath(): string {
  const bin = process.platform === 'win32' ? 'python.exe' : 'python3'
  const scriptsDir = process.platform === 'win32' ? 'Scripts' : 'bin'
  return join(app.getAppPath(), 'python', '.venv', scriptsDir, bin)
}

function runWhisperSidecar(wavPath: string, modelName: string, language: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonBin = pythonVenvPath()
    if (!existsSync(pythonBin)) {
      reject(
        new Error(
          'Ambiente Python do Whisper não encontrado. Rode: cd python && python3 -m venv .venv && ' +
            'source .venv/bin/activate && pip install -r requirements.txt'
        )
      )
      return
    }

    const scriptPath = join(app.getAppPath(), 'python', 'transcribe.py')
    const proc = spawn(pythonBin, [scriptPath, wavPath, modelName, language])

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Whisper falhou (código ${code}): ${stderr.trim().slice(-2000)}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as { text?: string }
        resolve(parsed.text ?? '')
      } catch (err) {
        reject(new Error(`Não foi possível interpretar a saída do Whisper: ${stdout.slice(-500)}`))
      }
    })
  })
}

export async function transcribeAudio(
  audioPath: string,
  onProgress?: (message: string) => void
): Promise<string> {
  const wavPath = audioPath.replace(/\.[^.]+$/, '.wav')

  onProgress?.('Convertendo áudio para WAV 16kHz...')
  await convertToWav(audioPath, wavPath)

  const modelName = settingsStore.get('whisperModel') || 'small'
  const language = settingsStore.get('whisperLanguage') || 'auto'

  onProgress?.(`Transcrevendo com Whisper (${modelName}) via faster-whisper local...`)
  const transcript = await runWhisperSidecar(wavPath, modelName, language)

  await unlink(wavPath).catch(() => {})

  return transcript.trim()
}
