/**
 * Templates de notas por tipo de reunião.
 *
 * Cada seção declara se seus itens são *rastreáveis* — ou seja, se afirmam algo
 * que alguém disse e portanto precisa bater com a transcrição. Isso é o que
 * mantém a checagem do Ledger funcionando quando o template muda a estrutura:
 * a verificação segue as seções marcadas, não títulos fixos no código.
 */

export type SectionFormat = 'prose' | 'bullets' | 'checkboxes'

export interface TemplateSection {
  heading: string
  instruction: string
  format: SectionFormat
  /** Itens desta seção são conferidos contra a transcrição. */
  traced: boolean
}

export interface NoteTemplate {
  id: string
  name: string
  description: string
  sections: TemplateSection[]
}

/** Texto que o modelo escreve quando uma seção não tem nada a registrar. */
export const EMPTY_MARKER = 'Nada explícito registrado'

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'general',
    name: 'Reunião geral',
    description: 'Estrutura padrão: resumo, pontos discutidos, decisões e ações.',
    sections: [
      {
        heading: 'Resumo',
        instruction: '2 a 4 frases objetivas sobre o que foi discutido.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Pontos principais',
        instruction: 'Os tópicos efetivamente discutidos.',
        format: 'bullets',
        traced: false
      },
      {
        heading: 'Decisões',
        instruction: 'Apenas decisões tomadas explicitamente na conversa.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Ações',
        instruction: 'Itens de ação, com responsável quando mencionado.',
        format: 'checkboxes',
        traced: true
      }
    ]
  },
  {
    id: 'one-on-one',
    name: '1:1',
    description: 'Conversa individual: temas, feedback trocado e combinados.',
    sections: [
      {
        heading: 'Contexto',
        instruction: 'Em 2 a 3 frases, o clima e o assunto central da conversa.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Temas discutidos',
        instruction: 'Assuntos trazidos por qualquer um dos lados.',
        format: 'bullets',
        traced: false
      },
      {
        heading: 'Feedback trocado',
        instruction: 'Feedback dado ou recebido, atribuindo a quem falou.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Combinados',
        instruction: 'O que ficou acordado, com responsável e prazo se ditos.',
        format: 'checkboxes',
        traced: true
      },
      {
        heading: 'Para a próxima',
        instruction: 'Assuntos explicitamente deixados para a próxima conversa.',
        format: 'bullets',
        traced: false
      }
    ]
  },
  {
    id: 'standup',
    name: 'Daily / Standup',
    description: 'Progresso, impedimentos e próximos passos por pessoa.',
    sections: [
      {
        heading: 'Progresso',
        instruction: 'O que cada pessoa relatou ter feito, agrupado por pessoa.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Impedimentos',
        instruction: 'Bloqueios levantados, com quem está bloqueado e por quê.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Próximos passos',
        instruction: 'O que cada pessoa disse que vai fazer em seguida.',
        format: 'checkboxes',
        traced: true
      }
    ]
  },
  {
    id: 'client',
    name: 'Reunião com cliente',
    description: 'Necessidades, objeções e compromissos assumidos.',
    sections: [
      {
        heading: 'Contexto do cliente',
        instruction: 'Situação e cenário do cliente conforme relatado por ele.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Necessidades levantadas',
        instruction: 'Dores, pedidos e requisitos que o cliente verbalizou.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Objeções e preocupações',
        instruction: 'Ressalvas levantadas pelo cliente, incluindo preço e prazo.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Compromissos assumidos',
        instruction: 'O que foi prometido ao cliente, e por quem.',
        format: 'checkboxes',
        traced: true
      },
      {
        heading: 'Próximos passos',
        instruction: 'Encaminhamentos acordados, com datas quando ditas.',
        format: 'checkboxes',
        traced: true
      }
    ]
  },
  {
    id: 'interview',
    name: 'Entrevista',
    description: 'Respostas por tema, sinais e pontos de atenção.',
    sections: [
      {
        heading: 'Perfil',
        instruction: 'Resumo da trajetória que a pessoa descreveu sobre si.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Respostas por tema',
        instruction: 'Agrupe as respostas pelos temas que foram perguntados.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Sinais positivos',
        instruction: 'Evidências concretas que a pessoa deu, citando o exemplo.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Pontos de atenção',
        instruction: 'Lacunas ou respostas vagas — descreva o que ficou em aberto.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Recomendação',
        instruction:
          'Sua leitura da entrevista em 1 a 2 frases. Esta seção é interpretação, ' +
          'não relato — deixe isso claro no texto.',
        format: 'prose',
        traced: false
      }
    ]
  },
  {
    id: 'planning',
    name: 'Planejamento / Kickoff',
    description: 'Objetivo, escopo acordado, riscos e responsáveis.',
    sections: [
      {
        heading: 'Objetivo',
        instruction: 'O objetivo do trabalho conforme enunciado na reunião.',
        format: 'prose',
        traced: false
      },
      {
        heading: 'Escopo acordado',
        instruction: 'O que entra no escopo, e o que foi explicitamente cortado.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Riscos levantados',
        instruction: 'Riscos e dependências citados, com quem os levantou.',
        format: 'bullets',
        traced: true
      },
      {
        heading: 'Responsáveis e prazos',
        instruction: 'Quem ficou com o quê, e para quando.',
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
      return 'texto corrido, sem lista'
    case 'checkboxes':
      return 'lista no formato "- [ ] item — responsável (se mencionado)"'
    case 'bullets':
      return 'lista com "- item"'
  }
}

/** Monta o system prompt a partir da estrutura declarada no template. */
export function buildSystemPrompt(template: NoteTemplate): string {
  const sectionSpec = template.sections
    .map((s) => `  ## ${s.heading}\n  (${s.instruction} Formato: ${formatHint(s.format)}.)`)
    .join('\n')

  return `Você transforma transcrições brutas de reuniões em notas estruturadas e objetivas, em português do Brasil. O tipo de reunião é: ${template.name} — ${template.description}

Regras estritas:
- Use APENAS informações que aparecem explicitamente na transcrição. Nunca invente nomes, números, datas, decisões ou compromissos que não foram ditos.
- Se um trecho estiver confuso ou incompleto, não tente adivinhar o que foi dito.
- Se uma seção não tiver nada a registrar, escreva exatamente "${EMPTY_MARKER}" nela.
- Estruture a saída em Markdown exatamente com estas seções, nesta ordem:
${sectionSpec}
- Seja conciso. Não escreva nada fora dessas seções.`
}

/** Títulos das seções cujos itens devem ser conferidos contra a transcrição. */
export function tracedHeadings(template: NoteTemplate): string[] {
  return template.sections.filter((s) => s.traced).map((s) => s.heading)
}
