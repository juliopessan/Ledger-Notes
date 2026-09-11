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

/** Raiz do sidecar: dentro do bundle quando empacotado, na pasta do projeto em dev. */
function pythonRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'python') : join(app.getAppPath(), 'python')
}

/**
 * Resolve o interpretador Python, em ordem: caminho configurado pelo usuário,
 * venv ao lado do script, e por último um python3 do sistema (que precisa ter
 * faster-whisper instalado).
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
          'Nenhum interpretador Python encontrado. Instale o Python 3 e rode o setup do Whisper ' +
            '(veja o README), ou aponte o caminho do Python em Configurações.'
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
