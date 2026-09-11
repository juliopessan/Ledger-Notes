# Ledger Notes

**The AI notepad for back-to-back meetings.**

App de notas de reunião com IA, 100% local, inspirado no [Granola](https://www.granola.ai/). O nome vem do design system que a UI usa: a transcrição é o dado *medido* (o que foi realmente dito) e as notas geradas por IA são a *asserção* — a interface nunca deixa as duas coisas parecerem iguais.

- Grava microfone + áudio do sistema (a chamada inteira, não só sua voz)
- Transcreve localmente com [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — o áudio nunca sai da sua máquina
- Gera notas estruturadas (resumo, decisões, ações) usando Claude ou GPT — você escolhe e usa sua própria chave de API
- Sem chave de API configurada, ainda gera notas básicas por heurística local (extraídas direto da transcrição, nunca inventadas) em vez de travar
- Sinaliza na interface qualquer item das notas que não foi encontrado na transcrição (checagem de alucinação), usando o design system **Ledger**: verde = rastreado à transcrição, laranja = não confirmado

## Como rodar

```bash
npm install
```

A transcrição roda num sidecar Python (`faster-whisper`) chamado pelo processo principal do Electron. Configure o ambiente uma vez:

```bash
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Depois:

```bash
npm run dev
```

Na primeira transcrição, o modelo Whisper escolhido em Configurações é baixado automaticamente (alguns minutos, dependendo do tamanho do modelo).

## Configuração necessária

1. Abra **Configurações** no app.
2. (Opcional) Escolha o provedor de IA para as notas (Anthropic ou OpenAI) e cole sua chave de API — sem chave, o app ainda funciona com notas por heurística local.
3. Escolha o modelo Whisper (`small` é um bom equilíbrio entre velocidade e precisão) e o idioma da transcrição.

## Permissões no macOS

Para capturar o áudio do sistema (outros participantes da chamada), o macOS pede permissão de **Gravação de Tela** na primeira vez — vá em Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela e habilite o app.

## Build para distribuição

```bash
npm run dist:mac
```

**Atenção:** o venv Python não é portável entre máquinas por padrão (caminhos absolutos no shebang). Para distribuir o app empacotado, é preciso embutir um runtime Python relocável (ex: [python-build-standalone](https://github.com/indygreg/python-build-standalone) ou PyInstaller compilando `python/transcribe.py`) — fora do escopo deste MVP, que roda em modo desenvolvimento na máquina de quem o construiu.

## Arquitetura

- `src/main` — processo principal Electron: armazenamento (JSON local em `~/Library/Application Support/ledger-notes`), transcrição (ffmpeg + sidecar Python `faster-whisper`), geração de notas (Anthropic/OpenAI SDK, com fallback heurístico local)
- `python/transcribe.py` — script Python standalone que roda `faster-whisper` sobre um WAV e imprime `{"text": "..."}` em stdout; chamado via `child_process.spawn` pelo main process
- `src/preload` — ponte segura `contextBridge` entre main e renderer
- `src/renderer` — UI em React, design system Ledger (`src/renderer/src/styles.css`)
- `src/shared/types.ts` — tipos compartilhados entre os três processos

## Limitações conhecidas do MVP

- Transcrição roda após o fim da gravação (não é ao vivo, palavra por palavra)
- Armazenamento em arquivo JSON único — adequado para dezenas/centenas de reuniões; migrar para SQLite se o volume crescer muito (vide nota sobre Xcode Command Line Tools abaixo)
- A checagem de "itens não rastreáveis" é uma heurística simples de sobreposição de palavras, não uma verificação semântica
- O fallback sem IA (heurística local) produz notas mais simples que um modelo de linguagem — pontos principais são frases extraídas da transcrição por amostragem, não uma síntese real
- Build empacotado (`dist:mac`) ainda não embute um runtime Python relocável — veja "Build para distribuição" acima

## Nota sobre SQLite

O projeto usa um armazenamento em JSON (`src/main/db.ts`) em vez de `better-sqlite3` porque as Xcode Command Line Tools desta máquina estavam com os receipts corrompidos no momento da criação do projeto, impedindo a compilação do módulo nativo. Para migrar para SQLite:

```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

Depois disso, `npm install better-sqlite3 @types/better-sqlite3` e reescrever `src/main/db.ts` mantendo a mesma API pública (`createMeeting`, `updateMeeting`, `getMeeting`, `listMeetings`, `deleteMeeting`).

## Créditos

A escolha de `faster-whisper` como motor de transcrição local e o padrão de fallback heurístico sem chave de API foram inspirados na arquitetura do [sessao-star](https://github.com/juliopessan/sessao-star), outro projeto local-first do mesmo autor.
