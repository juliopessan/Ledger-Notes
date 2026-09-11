# Ledger Notes

**Meeting notes that show their work.**

![Ledger Notes — AI notes you can actually defend](docs/hero.png)

[**Download for Mac**](https://github.com/juliopessan/Ledger-Notes/releases/latest) · [Landing page](https://juliopessan.github.io/Ledger-Notes/)

A local-first AI meeting notepad. The name comes from the design system the UI is built on: the transcript is the *measured* claim (what was actually said), AI-generated notes are the *assertion* — and the interface never lets the two look alike.

Every meeting opens with the same accounting: how much the model produced, and how much of it traces back to the transcript. The gap between the two bars is the point.

![A meeting's traceability ledger: five decisions and actions generated, two traced to the transcript, two from the user's own jottings](docs/shot-ledger.png)

- Records mic + system audio (the whole call, not just your voice)
- Jot sparse notes while the meeting runs — each line becomes an anchor the transcript fills in around, and your raw jottings are preserved verbatim in their own tab
- Transcribes locally with [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — audio never leaves your machine
- Six note templates by meeting type (general, 1:1, standup, client call, interview, planning); switch one after the fact and the notes are rewritten from the same transcript
- Generates structured notes (summary, decisions, action items) using Claude or GPT — bring your own API key
- No API key configured? It still produces basic notes via a local heuristic (extracted straight from the transcript, never invented) instead of blocking you
- Flags any note item that couldn't be matched back to the transcript (a lightweight hallucination check), using the **Ledger** design system: mint = traced to the transcript, clay = unconfirmed. An item that came from your own jottings rather than the recording is counted separately — your assertion is a different kind of claim than a quote, and blaming the model for it would be wrong

## Getting started

```bash
npm install
```

Transcription runs in a Python sidecar (`faster-whisper`) spawned by the Electron main process. Set it up once:

```bash
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Then:

```bash
npm run dev
```

On the first transcription, the Whisper model you picked in Settings downloads automatically (a few minutes, depending on the model size).

## Configuration

1. Open **Settings** in the app.
2. (Optional) Pick an AI provider for notes (Anthropic or OpenAI) and paste your API key — without one, the app still works with locally-generated heuristic notes.
3. Pick the Whisper model (`small` is a good speed/accuracy balance) and the transcription language.

## macOS permissions

To capture system audio (the other participants on the call), macOS asks for **Screen Recording** permission the first time — go to System Settings → Privacy & Security → Screen Recording and enable the app.

## Building for distribution

```bash
npm run dist:mac
```

Produces an unsigned `.dmg` for Apple Silicon in `dist/`. The `python/` sidecar script is bundled into the app's resources, and at runtime the app resolves a Python interpreter in this order: the path set in Settings → a `.venv` next to the bundled script → a system `python3` (Homebrew, `/usr/local`, `/usr/bin`). That interpreter still needs `faster-whisper` installed.

**The build is deliberately unsigned.** Signing and notarising require a paid Apple Developer ID, and this project is free, local-only and has no distribution budget. That is a standing decision, not an oversight — so macOS will always warn on first launch. Two ways past it, both free:

- Right-click the app → **Open** → **Open**. Only needed once.
- Or strip the quarantine flag from a terminal: `xattr -d com.apple.quarantine "/Applications/Ledger Notes.app"`

**One thing still genuinely open:** Python with `faster-whisper` must already be on the machine for transcription to work. The app bundles the sidecar script but not a runtime. Shipping a self-contained one (e.g. [python-build-standalone](https://github.com/indygreg/python-build-standalone) or a PyInstaller build of `python/transcribe.py`) would remove that setup step and costs nothing but effort.

## Development

```bash
npm run lint       # ESLint, zero warnings tolerated
npm run typecheck  # tsc over the main/preload and renderer projects
npm run build      # production bundle
```

CI runs all three on every push and pull request, plus a check that the Python sidecar imports `faster-whisper` and exits the way `transcription.ts` expects (`.github/workflows/ci.yml`).

## Landing page

`docs/index.html` is a static landing page, served by GitHub Pages from the `main` branch `/docs` folder. Nothing to build — open the file, or serve the folder:

```bash
python3 -m http.server 4173 --directory docs
```

## Architecture

- `src/main` — Electron main process: storage (local JSON in `~/Library/Application Support/ledger-notes`), transcription (ffmpeg + the `faster-whisper` Python sidecar), note generation (Anthropic/OpenAI SDK, with a local heuristic fallback)
- `python/transcribe.py` — standalone Python script that runs `faster-whisper` over a WAV file and prints `{"text": "..."}` to stdout; invoked via `child_process.spawn` from the main process
- `src/preload` — the `contextBridge` bridge between main and renderer
- `src/renderer` — React UI, built on the Ledger design system (`src/renderer/src/styles.css`)
- `src/shared/types.ts` — types shared across all three processes

## Known limitations (MVP)

- Transcription runs after the recording ends (not live, word-by-word)
- Storage is a single JSON file — fine for dozens/hundreds of meetings; migrate to SQLite if volume grows a lot (see the SQLite note below)
- The "untraceable items" check is a simple word-overlap heuristic, not a semantic check
- The no-AI fallback (local heuristic) produces simpler notes than a language model would — key points are sentences sampled from the transcript, not a real synthesis
- The packaged build (`dist:mac`) doesn't yet bundle a relocatable Python runtime, and isn't code-signed — see "Building for distribution" above
- **Whisper's automatic language detection mis-fires on mixed-language audio.** Verified the hard way: a recording that opened with a few Portuguese words and then played English speech came back transcribed as phonetic Portuguese — "the quarterly budget review" became "de quarta ele budget, rívio". The audio was captured correctly; the language was not. If your meetings are reliably in one language, set it explicitly in Settings rather than leaving it on "Detect automatically"

## A note on SQLite

The project uses JSON file storage (`src/main/db.ts`) instead of `better-sqlite3` because this machine's Xcode Command Line Tools had corrupted receipts at the time the project was created, blocking the native module build. To migrate to SQLite:

```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

Then `npm install better-sqlite3 @types/better-sqlite3` and rewrite `src/main/db.ts`, keeping the same public API (`createMeeting`, `updateMeeting`, `getMeeting`, `listMeetings`, `deleteMeeting`).

## Credits

The choice of `faster-whisper` as the local transcription engine, and the no-API-key heuristic fallback pattern, were inspired by the architecture of [sessao-star](https://github.com/juliopessan/sessao-star), another local-first project by the same author.
