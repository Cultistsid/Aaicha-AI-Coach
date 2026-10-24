# CLAUDE.md — 12-rule template

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

---

## Project notes — Aaicha

Concrete grounding for the rules above when working in this repo.

- **Two processes, one repo.** `electron/` is Node (main process), `src/` is the renderer. They share types via `src/types/electron.d.ts`. Any IPC change touches all three: `electron/ipcHandlers.ts`, `electron/preload.ts`, `src/types/electron.d.ts`. Rule 8 applies — read all three before adding a channel.
- **The hot path is the coach loop.** `useSpeechRecognition` → main `STTHelper` → `coach:turn` IPC → `ClaudeHelper.coachTurn` → streamed deltas back to `ListeningMode.tsx`. Latency and token cost both live here. Before changing anything in this path, state which leg you're touching and why (Rule 1).
- **Design tokens, not raw hex.** `tailwind.config.js` defines `paper`, `ink`, `coral`, `line`, the serif/sans/mono stacks, and animations. Use them. New colors mean updating the config, not inlining `#cc785c` in a className (Rule 11).
- **Two models on purpose.** `claude-opus-4-7` for chat, `claude-haiku-4-5` for coach. Don't unify them to "simplify" — the split is a cost decision documented in `ClaudeHelper.ts` (Rule 3, Rule 7).
- **Secrets live in `~/Library/Application Support/Aaicha/.env`** for installed builds, repo-root `.env` for dev. Both are gitignored. Never commit either, never log their values (Rule 12).
- **Packaged app uses `file://`**. Any new asset the renderer fetches at runtime must be a relative path (`./foo.js`), not absolute (`/foo.js`), or it breaks in the DMG build.
