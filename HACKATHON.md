# 🎯 Aaicha — Hackathon Submission

## What It Is

Aaicha is a **real-time AI interview coach** that sits quietly on your desktop and listens during calls. It provides instant, context-aware coaching using Claude AI and Google Cloud Speech-to-Text.

## The Problem We Solved

**Interviews are high-pressure**. You're thinking about what to say, how to say it, and whether you're hitting the right points — all while trying to sound natural. Traditional interview prep is static: mock interviews, scripted answers, YouTube tips. None of that helps in the moment when you blank on a question.

Aaicha gives you **live coaching** during the actual interview.

## How It Works

1. **Always-on overlay**: Small, draggable window that stays on top
2. **Voice capture**: Listens to your interview in real-time via system audio
3. **Smart transcription**: Google Cloud Speech-to-Text converts speech to text with low latency
4. **AI coaching engine**: Claude AI analyzes the conversation and provides:
   - **STAR-formatted answers** when you're asked a question
   - **Real-time feedback** on your delivery (pacing, clarity, structure)
   - **Silent mode** for filler words — no distractions
5. **Whisper to coach**: Text input for asking the coach side questions without speaking them aloud

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Electron (Node.js main process)
- **AI Models**:
  - Claude Opus 4.7 (chat interface)
  - Claude Haiku 4.5 (live coaching — optimized for speed and cost)
- **Speech-to-Text**: Google Cloud Speech-to-Text API (streaming recognition)
- **UI**: Tailwind CSS + Radix UI
- **Build**: electron-builder (DMG for macOS)
- **Testing**: Vitest + Playwright + AI-assisted tests
- **CI/CD**: GitHub Actions
- **Dev Tools**: Devin AI CLI (code review & analysis)

## Key Features

### 1. **Listening Mode**
- Live transcript on the left pane
- AI coaching on the right pane
- Detects when you're being asked a question vs. when you're answering
- Streams responses in real-time

### 2. **Screenshot Analysis**
- Hit `⌘H` to capture your screen
- Ask Claude about what's on your screen
- Useful for reviewing shared docs, diagrams, or code during technical interviews

### 3. **Global Shortcuts**
- `⌘B` — toggle window visibility
- `⌘⇧Space` — show/center window
- `⌘R` — clear chat history
- Arrow keys for window positioning

### 4. **Privacy-First**
- All data stays local until sent to APIs (Claude, Google Cloud)
- No data storage on external servers
- `.env` file for API keys (gitignored)
- User controls when the mic is active

## Installation & Setup

```bash
# Clone the repo
git clone https://github.com/inSideos-designs/Aaicha.git
cd Aaicha

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your ANTHROPIC_API_KEY and GOOGLE_CLOUD_PROJECT

# Run in development
npm start

# Build for production
npm run dist
```

## Devin AI Integration

We've integrated **Devin AI CLI** for automated code review and quality checks:

```bash
# Run Devin analysis
npm run devin:check

# Get detailed JSON report
npm run devin:analyze

# Interactive fix mode
npm run devin:fix
```

Devin runs automatically in our CI/CD pipeline on every PR.

## Demo

1. Launch Aaicha
2. Start a mock interview (or real one)
3. Hit the headphones icon to enter Listening Mode
4. Speak naturally — watch the live transcript fill the left pane
5. See AI coaching appear on the right in real-time

## What Makes This Special

- **Real-time, not reactive**: Most coaching tools require you to record and review later. Aaicha works *during* the interview.
- **Context-aware**: The AI understands whether you're being asked a question or delivering an answer, and adjusts its coaching accordingly.
- **Optimized for speed AND cost**: We use Opus for deep reasoning in chat, but Haiku for the live coach (5-10x cheaper, 3-4x faster).
- **Native desktop experience**: Not a web app — it's a proper macOS application with global shortcuts and always-on-top positioning.

## Challenges We Overcame

1. **Latency**: Streaming speech-to-text and AI responses with minimal delay required careful async handling and PCM audio streaming.
2. **Context switching**: Detecting when the interviewer is asking vs. when the candidate is answering required prompt engineering and streaming state management.
3. **Cost optimization**: Running Claude on every spoken sentence would be expensive — we implemented smart buffering and model selection.
4. **Electron + Vite + TypeScript**: Getting hot module reload working with IPC handlers and preload scripts was tricky.

## Future Roadmap

- [ ] Multi-language support (currently English-only)
- [ ] Interview recording & playback
- [ ] Analytics dashboard (track filler words, pacing, answer quality over time)
- [ ] Plugin system for custom coaching styles
- [ ] Windows & Linux builds

## License

ISC

---

**Built by Sid** — because I needed it, and now it exists.
