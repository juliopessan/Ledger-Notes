#!/usr/bin/env python3
"""Transcreve um arquivo de áudio localmente com faster-whisper.

Uso: python transcribe.py <audio_path> <model_size> [language]

Imprime APENAS um JSON de uma linha em stdout: {"text": "..."}
Qualquer log/erro vai para stderr, para não contaminar o stdout que o
processo Electron (main/transcription.ts) precisa parsear.
"""
import json
import sys


def main() -> None:
    if len(sys.argv) < 3:
        print("uso: transcribe.py <audio_path> <model_size> [language]", file=sys.stderr)
        sys.exit(2)

    audio_path = sys.argv[1]
    model_size = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "auto" else None

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "faster-whisper não está instalado. Rode: cd python && "
            "python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        model = WhisperModel(model_size, device="auto", compute_type="int8")
        segments, _info = model.transcribe(audio_path, language=language, beam_size=5)
        text = " ".join(seg.text.strip() for seg in segments).strip()
    except Exception as exc:  # noqa: BLE001
        print(f"Falha ao transcrever com Whisper: {exc}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({"text": text}))


if __name__ == "__main__":
    main()
