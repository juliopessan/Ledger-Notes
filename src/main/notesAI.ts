import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { settingsStore } from './store'
import {
  buildSystemPrompt,
  getTemplate,
  tracedHeadings,
  EMPTY_MARKER,
  type NoteTemplate
} from '../shared/templates'

function buildUserPrompt(transcript: string): string {
  return `Transcrição da reunião:\n\n"""\n${transcript}\n"""\n\nGere as notas estruturadas seguindo exatamente as regras do sistema.`
}

async function generateWithAnthropic(transcript: string, template: NoteTemplate): Promise<string> {
  const apiKey = settingsStore.get('anthropicApiKey')
  if (!apiKey) throw new Error('Chave de API da Anthropic não configurada. Abra Configurações.')
  const client = new Anthropic({ apiKey })
  const model = settingsStore.get('anthropicModel') || 'claude-sonnet-4-5'
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: buildSystemPrompt(template),
    messages: [{ role: 'user', content: buildUserPrompt(transcript) }]
  })
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

async function generateWithOpenAI(transcript: string, template: NoteTemplate): Promise<string> {
  const apiKey = settingsStore.get('openaiApiKey')
  if (!apiKey) throw new Error('Chave de API da OpenAI não configurada. Abra Configurações.')
  const client = new OpenAI({ apiKey })
  const model = settingsStore.get('openaiModel') || 'gpt-4o'
  const response = await client.chat.completions.create({
    model,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: buildSystemPrompt(template) },
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
 * Fallback local, sem IA: monta as seções do template escolhido preenchendo-as
 * com trechos extraídos da própria transcrição (nunca inventa nada), quando
 * nenhuma chave de API está configurada. Qualidade inferior à de um modelo de
 * linguagem, mas mantém o app utilizável offline e sem custo.
 */
function localHeuristicNotes(transcript: string, template: NoteTemplate): string {
  const sentences = splitSentences(transcript)
  const step = Math.max(1, Math.floor(sentences.length / 6))
  const sampled = sentences.filter((_, i) => i % step === 0).slice(0, 6)

  const lines: string[] = []

  for (const section of template.sections) {
    lines.push(`## ${section.heading}`)

    if (section.format === 'prose') {
      lines.push(sentences.slice(0, 3).join(' ') || EMPTY_MARKER)
      lines.push('')
      continue
    }

    // Seções rastreadas recebem frases que trazem marcadores de decisão ou
    // compromisso; as demais recebem uma amostragem do que foi dito.
    const keywords = section.format === 'checkboxes' ? ACTION_KEYWORDS : DECISION_KEYWORDS
    const picked = section.traced
      ? sentences.filter((s) => containsAny(s.toLowerCase(), keywords))
      : sampled

    if (picked.length === 0) {
      lines.push(EMPTY_MARKER)
    } else {
      const prefix = section.format === 'checkboxes' ? '- [ ] ' : '- '
      lines.push(...picked.map((p) => `${prefix}${p}`))
    }
    lines.push('')
  }

  lines.push(
    '> Notas geradas localmente por heurística (sem IA) — nenhuma chave de API configurada. ' +
      'Configure uma em Configurações para notas mais precisas.'
  )

  return lines.join('\n')
}

export async function generateMeetingNotes(
  transcript: string,
  templateId?: string
): Promise<string> {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcrição vazia — não é possível gerar notas.')
  }
  const template = getTemplate(templateId ?? settingsStore.get('defaultTemplateId'))
  const provider = settingsStore.get('aiProvider') || 'anthropic'
  const apiKey = provider === 'openai' ? settingsStore.get('openaiApiKey') : settingsStore.get('anthropicApiKey')

  if (!apiKey) {
    return localHeuristicNotes(transcript, template)
  }

  return provider === 'openai'
    ? generateWithOpenAI(transcript, template)
    : generateWithAnthropic(transcript, template)
}

export interface NoteTraceability {
  total: number
  untraceable: string[]
}

function normalizeHeading(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Heurística simples de checagem de alucinação: percorre as seções que o
 * template marcou como rastreáveis e verifica se as palavras significativas de
 * cada item aparecem na transcrição original. Alimenta a barra pareada do
 * Ledger (itens gerados vs. rastreados) e a lista do flag.
 *
 * Segue o template e não títulos fixos — de outro modo, qualquer template novo
 * zeraria a contagem silenciosamente e a UI mostraria "nada a verificar"
 * justamente quando há mais a verificar.
 */
export function getNoteTraceability(
  notesMarkdown: string,
  transcript: string,
  templateId?: string
): NoteTraceability {
  const template = getTemplate(templateId)
  const tracked = new Set(tracedHeadings(template).map(normalizeHeading))
  const transcriptLower = transcript.toLowerCase()
  const lines = notesMarkdown.split('\n')
  const untraceable: string[] = []
  let total = 0
  let inTrackedSection = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const headingMatch = line.match(/^##\s+(.*)$/)
    if (headingMatch) {
      inTrackedSection = tracked.has(normalizeHeading(headingMatch[1]))
      continue
    }
    if (!inTrackedSection) continue
    if (!/^[-*]\s/.test(line)) continue

    const content = line.replace(/^[-*]\s*(\[ \]|\[x\])?\s*/i, '')
    if (!content || normalizeHeading(content) === normalizeHeading(EMPTY_MARKER)) continue
    if (/^nenhum[ao]\s/i.test(content)) continue

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
