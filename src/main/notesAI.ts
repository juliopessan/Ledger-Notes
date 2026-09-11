import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { settingsStore } from './store'

const SYSTEM_PROMPT = `Você é um assistente que transforma transcrições brutas de reuniões em notas estruturadas e objetivas, em português do Brasil.

Regras estritas:
- Use APENAS informações que aparecem explicitamente na transcrição. Nunca invente nomes, números, datas ou decisões que não foram ditos.
- Se um trecho da transcrição estiver confuso ou incompleto, não tente adivinhar o que foi dito.
- Estruture a saída em Markdown com estas seções, nessa ordem:
  ## Resumo
  (2-4 frases objetivas sobre o que foi discutido)
  ## Pontos principais
  (lista com os tópicos discutidos)
  ## Decisões
  (lista das decisões tomadas explicitamente; se nenhuma foi tomada, escreva "Nenhuma decisão explícita registrada")
  ## Ações
  (lista de itens de ação no formato "- [ ] Ação — responsável (se mencionado)"; se nenhum foi mencionado, escreva "Nenhuma ação explícita registrada")
- Seja conciso. Não adicione comentários fora dessas seções.`

function buildUserPrompt(transcript: string): string {
  return `Transcrição da reunião:\n\n"""\n${transcript}\n"""\n\nGere as notas estruturadas seguindo exatamente as regras do sistema.`
}

async function generateWithAnthropic(transcript: string): Promise<string> {
  const apiKey = settingsStore.get('anthropicApiKey')
  if (!apiKey) throw new Error('Chave de API da Anthropic não configurada. Abra Configurações.')
  const client = new Anthropic({ apiKey })
  const model = settingsStore.get('anthropicModel') || 'claude-sonnet-4-5'
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(transcript) }]
  })
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

async function generateWithOpenAI(transcript: string): Promise<string> {
  const apiKey = settingsStore.get('openaiApiKey')
  if (!apiKey) throw new Error('Chave de API da OpenAI não configurada. Abra Configurações.')
  const client = new OpenAI({ apiKey })
  const model = settingsStore.get('openaiModel') || 'gpt-4o'
  const response = await client.chat.completions.create({
    model,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(transcript) }
    ]
  })
  return response.choices[0]?.message?.content ?? ''
}

const DECISION_KEYWORDS = [
  'decidimos', 'ficou decidido', 'ficou combinado', 'vamos com', 'concordamos',
  'combinado que', 'definimos', 'a decisão foi'
]

const ACTION_KEYWORDS = [
  'vou fazer', 'você vai', 'precisa', 'precisamos', 'ação:', 'fica responsável',
  'até sexta', 'até amanhã', 'próximos passos', 'vamos enviar', 'vou enviar'
]

function splitSentences(transcript: string): string[] {
  return transcript
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
}

function containsAny(sentenceLower: string, keywords: string[]): boolean {
  return keywords.some((k) => sentenceLower.includes(k))
}

/**
 * Fallback local, sem IA: extrai as notas diretamente de trechos da
 * transcrição (nunca inventa nada) quando nenhuma chave de API está
 * configurada. Qualidade inferior a um modelo de linguagem, mas mantém o
 * app utilizável offline / sem custo.
 */
function localHeuristicNotes(transcript: string): string {
  const sentences = splitSentences(transcript)

  const resumo = sentences.slice(0, 3).join(' ') || 'Transcrição muito curta para resumir.'

  const step = Math.max(1, Math.floor(sentences.length / 6))
  const pontos = sentences.filter((_, i) => i % step === 0).slice(0, 6)

  const decisoes = sentences.filter((s) => containsAny(s.toLowerCase(), DECISION_KEYWORDS))
  const acoes = sentences.filter((s) => containsAny(s.toLowerCase(), ACTION_KEYWORDS))

  const lines: string[] = []
  lines.push('## Resumo', resumo, '')
  lines.push('## Pontos principais')
  lines.push(...(pontos.length ? pontos.map((p) => `- ${p}`) : ['- (transcrição sem pontos identificáveis)']))
  lines.push('')
  lines.push('## Decisões')
  lines.push(...(decisoes.length ? decisoes.map((d) => `- ${d}`) : ['Nenhuma decisão explícita registrada']))
  lines.push('')
  lines.push('## Ações')
  lines.push(...(acoes.length ? acoes.map((a) => `- [ ] ${a}`) : ['Nenhuma ação explícita registrada']))
  lines.push('')
  lines.push(
    '> Notas geradas localmente por heurística (sem IA) — nenhuma chave de API configurada. ' +
      'Configure uma em Configurações para notas mais precisas.'
  )

  return lines.join('\n')
}

export async function generateMeetingNotes(transcript: string): Promise<string> {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcrição vazia — não é possível gerar notas.')
  }
  const provider = settingsStore.get('aiProvider') || 'anthropic'
  const apiKey = provider === 'openai' ? settingsStore.get('openaiApiKey') : settingsStore.get('anthropicApiKey')

  if (!apiKey) {
    return localHeuristicNotes(transcript)
  }

  return provider === 'openai' ? generateWithOpenAI(transcript) : generateWithAnthropic(transcript)
}

export interface NoteTraceability {
  total: number
  untraceable: string[]
}

/**
 * Heurística simples de checagem de alucinação: extrai frases das seções
 * "Decisões" e "Ações" e verifica se alguma palavra-chave significativa
 * aparece na transcrição original. Usado pela UI (Ledger) para a barra
 * pareada (itens gerados vs. rastreados) e para sinalizar itens não
 * rastreáveis ao texto medido.
 */
export function getNoteTraceability(notesMarkdown: string, transcript: string): NoteTraceability {
  const transcriptLower = transcript.toLowerCase()
  const lines = notesMarkdown.split('\n')
  const untraceable: string[] = []
  let total = 0
  let inTrackedSection = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (/^##\s*(Decisões|Ações)/i.test(line)) {
      inTrackedSection = true
      continue
    }
    if (/^##\s/.test(line)) {
      inTrackedSection = false
      continue
    }
    if (!inTrackedSection) continue
    if (!/^[-*]\s/.test(line)) continue

    const content = line.replace(/^[-*]\s*(\[ \]|\[x\])?\s*/i, '')
    if (!content || /nenhuma (decisão|ação)/i.test(content)) continue

    total += 1

    const words = content
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4)

    const matchCount = words.filter((w) => transcriptLower.includes(w)).length
    const ratio = words.length > 0 ? matchCount / words.length : 1

    if (ratio < 0.3) {
      untraceable.push(content)
    }
  }

  return { total, untraceable }
}
