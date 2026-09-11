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

function buildUserPrompt(transcript: string, userNotes?: string | null): string {
  const base = `Meeting transcript:\n\n"""\n${transcript}\n"""`

  if (!userNotes || userNotes.trim().length === 0) {
    return `${base}\n\nWrite the structured notes, following the system rules exactly.`
  }

  return `${base}

The person typed these notes during the meeting itself:

"""
${userNotes.trim()}
"""

Those jottings say what mattered to them. When assembling the notes:
- Treat each of their lines as an anchor: develop the point using what the transcript shows about that subject.
- Respect their priorities — within each section, what they wrote down comes first.
- If one of their jottings has no support in the transcript, keep the point anyway, but do not invent detail around it.
- Do not drop relevant subjects from the transcript just because they did not write them down.

Write the structured notes, following the system rules exactly.`
}

async function generateWithAnthropic(
  transcript: string,
  template: NoteTemplate,
  userNotes?: string | null
): Promise<string> {
  const apiKey = settingsStore.get('anthropicApiKey')
  if (!apiKey) throw new Error('No Anthropic API key configured. Open Settings.')
  const client = new Anthropic({ apiKey })
  const model = settingsStore.get('anthropicModel') || 'claude-sonnet-4-5'
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: buildSystemPrompt(template),
    messages: [{ role: 'user', content: buildUserPrompt(transcript, userNotes) }]
  })
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

async function generateWithOpenAI(
  transcript: string,
  template: NoteTemplate,
  userNotes?: string | null
): Promise<string> {
  const apiKey = settingsStore.get('openaiApiKey')
  if (!apiKey) throw new Error('No OpenAI API key configured. Open Settings.')
  const client = new OpenAI({ apiKey })
  const model = settingsStore.get('openaiModel') || 'gpt-4o'
  const response = await client.chat.completions.create({
    model,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: buildSystemPrompt(template) },
      { role: 'user', content: buildUserPrompt(transcript, userNotes) }
    ]
  })
  return response.choices[0]?.message?.content ?? ''
}

// These match against the transcript, whose language is independent of the
// app's — a meeting held in Portuguese still needs to be usable when no API
// key is set, so both sets stay.
const DECISION_KEYWORDS = [
  'we decided', 'we agreed', "let's go with", 'the decision was', 'it was agreed',
  'decidimos', 'ficou decidido', 'ficou combinado', 'vamos com', 'concordamos',
  'combinado que', 'definimos', 'a decisão foi'
]

const ACTION_KEYWORDS = [
  'i will', 'you will', 'we need to', 'action item', 'takes ownership',
  'by friday', 'by tomorrow', 'next steps', 'will send', 'will follow up',
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
 * Local fallback, no AI: builds the chosen template's sections and fills them
 * with passages lifted straight from the transcript (it never invents
 * anything), for when no API key is configured. Weaker than a language model,
 * but it keeps the app usable offline and at no cost.
 */
function localHeuristicNotes(
  transcript: string,
  template: NoteTemplate,
  userNotes?: string | null
): string {
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

    // Traced sections get sentences carrying decision or commitment markers;
    // the rest get a sample of what was said.
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
    '> Generated locally by heuristic, without AI — no API key is configured. ' +
      'Set one in Settings for sharper notes.'
  )

  if (userNotes && userNotes.trim().length > 0) {
    // Without a language model there is no honest way to merge the jottings
    // into the text. They are still kept whole under the "Your notes" tab —
    // claiming they were folded in would be false.
    lines.push(
      '>',
      '> Your own jottings were not merged into these notes: fusing the two ' +
        'texts needs a language model. They are preserved, in full, under the ' +
        '"Your notes" tab.'
    )
  }

  return lines.join('\n')
}

export async function generateMeetingNotes(
  transcript: string,
  templateId?: string,
  userNotes?: string | null
): Promise<string> {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Empty transcript — there is nothing to write notes from.')
  }
  const template = getTemplate(templateId ?? settingsStore.get('defaultTemplateId'))
  const provider = settingsStore.get('aiProvider') || 'anthropic'
  const apiKey = provider === 'openai' ? settingsStore.get('openaiApiKey') : settingsStore.get('anthropicApiKey')

  if (!apiKey) {
    return localHeuristicNotes(transcript, template, userNotes)
  }

  return provider === 'openai'
    ? generateWithOpenAI(transcript, template, userNotes)
    : generateWithAnthropic(transcript, template, userNotes)
}

export interface NoteTraceability {
  total: number
  untraceable: string[]
  fromUserNotes: string[]
}

function normalizeHeading(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function overlapRatio(content: string, haystackLower: string): number {
  const words = content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)

  if (words.length === 0) return 1
  return words.filter((w) => haystackLower.includes(w)).length / words.length
}

/**
 * A simple hallucination check: it walks the sections the template marked as
 * traced and tests whether each item's significant words appear in the
 * transcript. Feeds the Ledger's paired bars (generated vs. traced) and the
 * flag's list.
 *
 * It follows the template rather than fixed headings — otherwise any new
 * template would silently zero the count, and the UI would report "nothing to
 * verify" exactly when there was more to verify.
 *
 * An item with no support in the transcript but present in the person's own
 * jottings is not a hallucination: it is their assertion. It leaves the flag
 * for a category of its own, because marking it "invented" would blame the
 * model for something the human wrote.
 */
export function getNoteTraceability(
  notesMarkdown: string,
  transcript: string,
  templateId?: string,
  userNotes?: string | null
): NoteTraceability {
  const template = getTemplate(templateId)
  const tracked = new Set(tracedHeadings(template).map(normalizeHeading))
  const transcriptLower = transcript.toLowerCase()
  const userNotesLower = (userNotes ?? '').toLowerCase()
  const lines = notesMarkdown.split('\n')
  const untraceable: string[] = []
  const fromUserNotes: string[] = []
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
    // Back-compat: meetings written before the templates moved to English
    // still carry "Nenhuma decisão/ação explícita registrada" as their empty
    // marker, and those placeholders must not be counted as claims.
    if (/^nenhum[ao]\s/i.test(content)) continue

    total += 1

    if (overlapRatio(content, transcriptLower) >= 0.3) continue

    if (userNotesLower && overlapRatio(content, userNotesLower) >= 0.3) {
      fromUserNotes.push(content)
    } else {
      untraceable.push(content)
    }
  }

  return { total, untraceable, fromUserNotes }
}
