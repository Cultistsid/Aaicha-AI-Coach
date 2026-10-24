# Aaicha — Real-Time AI Interview Coach

A small desktop window that sits next to me during the day. Type a question, paste a screenshot, or hit Listening Mode to get live coaching during an interview or call.

**[📄 Hackathon Submission Details](HACKATHON.md)**

## What it uses

- Electron + React for the shell
- Claude (Opus 4.7 for chat, Haiku 4.5 for the live coach) — Anthropic API
- Google Cloud Speech-to-Text for the live transcript in Listening Mode

## Running it

You need:

- Node 18+
- An Anthropic API key
- A Google Cloud project with the Speech-to-Text API enabled, and `gcloud auth application-default login` done locally

```bash
npm install
```

Make a `.env` in the repo root:

```
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_CLOUD_LOCATION=us-central1
```

Optional overrides:

```
CLAUDE_CHAT_MODEL=claude-opus-4-7
CLAUDE_COACH_MODEL=claude-haiku-4-5
```

Then:

```bash
npm start
```

That runs Vite on `:5180` and launches the Electron window.

## Shortcuts

- `⌘B` — toggle window
- `⌘H` — screenshot the screen (lands as an attachment, ask a question about it)
- `⌘⇧Space` — show / center window
- `⌘R` — clear the chat
- `⌘← / ⌘→ / ⌘↑ / ⌘↓` — nudge the window around

## Listening Mode

Hit the headphones icon in the header.

- Speak naturally. Live transcript fills the left pane.
- The coach replies on the right. It tries to detect:
  - **Answer mode** — somebody asks the candidate a question → coach drops a ready-to-read STAR-style answer
  - **Coach mode** — candidate is delivering → coach gives terse "what worked / what to tighten" feedback
  - **Silent mode** — for "um, yeah, okay" filler. Suppressed in the UI.
- "Whisper to coach" box (bottom right) lets you ask the coach a side question without speaking it out loud.

## Notes

- `.env` is gitignored. Don't commit your keys.
- Anthropic + GCP both cost real money. A 2-min listening session is roughly a few cents on the current model split.
- macOS only is the only platform I've actually run it on. Other platforms may need icon / entitlements work.

## License

ISC.
