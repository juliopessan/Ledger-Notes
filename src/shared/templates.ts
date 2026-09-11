/**
 * Note templates, one per meeting type.
 *
 * Each section declares whether its items are *traced* — that is, whether they
 * assert something somebody said and therefore have to match the transcript.
 * This is what keeps the Ledger check working when a template changes the
 * structure: verification follows the sections marked here, not headings
 * hardcoded somewhere else.
 */

export type SectionFormat = 'prose' | 'bullets' | 'checkboxes'

export interface TemplateSection {
  heading: string
  instruction: string
  format: SectionFormat
  /** Items in this section get checked against the transcript. */
  traced: boolean
}

export interface NoteTemplate {
  id: string
  name: string
  description: string
  sections: TemplateSection[]
}

/** What the model writes when a section has nothing to record. */
export const EMPTY_MARKER = 'Nothing explicitly recorded'

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'general',
    name: 'General meeting',
    description: 'The default shape: summary, topics discussed, decisions and actions.',
    sections: [
      {
        heading: 'Summary',
        instruction: '2 to 4 plain sentences on what was discussed.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Key points',
        instruction: 'The topics that were actually discussed.',
        format: 'bullets',
        traced: false
      },
      {
        heading: 'Decisions',
        instruction: 'Only decisions explicitly reached in the conversation.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Actions',
        instruction: 'Action items, with the owner when one was named.',
        format: 'checkboxes',
        traced: true
      }
    ]
  },
  {
    id: 'one-on-one',
    name: '1:1',
    description: 'A one-to-one: themes raised, feedback exchanged, what was agreed.',
    sections: [
      {
        heading: 'Context',
        instruction: 'In 2 to 3 sentences, the tone and the central subject.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Themes discussed',
        instruction: 'Subjects raised by either side.',
        format: 'bullets',
        traced: false
      },
      {
        heading: 'Feedback exchanged',
        instruction: 'Feedback given or received, attributed to whoever said it.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Agreed',
        instruction: 'What was settled, with owner and deadline if stated.',
        format: 'checkboxes',
        traced: true
      },
      {
        heading: 'For next time',
        instruction: 'Subjects explicitly deferred to the next conversation.',
        format: 'bullets',
        traced: false
      }
    ]
  },
  {
    id: 'standup',
    name: 'Daily / Standup',
    description: 'Progress, blockers and next steps, per person.',
    sections: [
      {
        heading: 'Progress',
        instruction: 'What each person reported doing, grouped by person.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Blockers',
        instruction: 'Blockers raised, naming who is blocked and why.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Next steps',
        instruction: 'What each person said they would do next.',
        format: 'checkboxes',
        traced: true
      }
    ]
  },
  {
    id: 'client',
    name: 'Client call',
    description: 'Needs raised, objections, and what was committed to.',
    sections: [
      {
        heading: 'Client context',
        instruction: "The client's situation as they described it.",
        format: 'prose',
        traced: false
      },
      {
        heading: 'Needs raised',
        instruction: 'Pains, requests and requirements the client put into words.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Objections and concerns',
        instruction: 'Reservations the client raised, price and timing included.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Commitments made',
        instruction: 'What was promised to the client, and by whom.',
        format: 'checkboxes',
        traced: true
      },
      {
        heading: 'Next steps',
        instruction: 'Agreed follow-ups, with dates when they were stated.',
        format: 'checkboxes',
        traced: true
      }
    ]
  },
  {
    id: 'interview',
    name: 'Interview',
    description: 'Answers by theme, positive signals and open questions.',
    sections: [
      {
        heading: 'Profile',
        instruction: 'A summary of the background the candidate described.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Answers by theme',
        instruction: 'Group the answers under the themes that were asked about.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Positive signals',
        instruction: 'Concrete evidence the candidate gave, citing the example.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Open questions',
        instruction: 'Gaps or vague answers — describe what was left unresolved.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Recommendation',
        instruction:
          'Your read on the interview in 1 to 2 sentences. This section is ' +
          'interpretation, not reporting — make that explicit in the text.',
        format: 'prose',
        traced: false
      }
    ]
  },
  {
    id: 'planning',
    name: 'Planning / Kickoff',
    description: 'Objective, agreed scope, risks and owners.',
    sections: [
      {
        heading: 'Objective',
        instruction: 'The objective of the work as stated in the meeting.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Agreed scope',
        instruction: 'What is in scope, and what was explicitly cut.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Risks raised',
        instruction: 'Risks and dependencies mentioned, and who raised them.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Owners and deadlines',
        instruction: 'Who took what, and by when.',
        format: 'checkboxes',
        traced: true
      }
    ]
  }
]

export const DEFAULT_TEMPLATE_ID = 'general'

export function getTemplate(id: string | null | undefined): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? NOTE_TEMPLATES[0]
}

function formatHint(format: SectionFormat): string {
  switch (format) {
    case 'prose':
      return 'running prose, no list'
    case 'checkboxes':
      return 'a list of "- [ ] item — owner (if named)"'
    case 'bullets':
      return 'a list of "- item"'
  }
}

/** Builds the system prompt from the structure the template declares. */
export function buildSystemPrompt(template: NoteTemplate): string {
  const sectionSpec = template.sections
    .map((s) => `  ## ${s.heading}\n  (${s.instruction} Format: ${formatHint(s.format)}.)`)
    .join('\n')

  return `You turn raw meeting transcripts into structured, plain notes. The meeting type is: ${template.name} — ${template.description}

Strict rules:
- Use ONLY information that appears explicitly in the transcript. Never invent names, numbers, dates, decisions or commitments that were not said.
- If a passage is unclear or incomplete, do not guess at what was said.
- If a section has nothing to record, write exactly "${EMPTY_MARKER}" in it.
- Write the body of the notes in the same language as the transcript. Keep the section headings exactly as given below, in English, whatever that language is.
- Structure the output as Markdown with exactly these sections, in this order:
${sectionSpec}
- Be concise. Write nothing outside those sections.`
}

/** Headings whose items must be checked against the transcript. */
export function tracedHeadings(template: NoteTemplate): string[] {
  return template.sections.filter((s) => s.traced).map((s) => s.heading)
}
