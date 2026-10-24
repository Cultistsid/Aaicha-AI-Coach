# Aaicha front-end fix — design

Date: 2026-07-05. Approved by Sid (Approach A: surgical two-track).

## Problem

Three complaints, all in the renderer:

1. **Scroll misbehavior.** Every streamed coach delta and transcript update fires
   `scrollTo({top: 1e9, behavior: "smooth"})` on its pane. Smooth-scroll animations
   pile up during streaming and yank the user to the bottom even after they scrolled
   up to re-read an earlier answer.
2. **Bland/unpolished visuals.** Uniform small text; coach answers (the highest-value
   content on interview day) look the same as filler; timestamps overweighted.
3. **Hard to use mid-interview.** Coach pane and overlay are not glanceable enough
   under pressure; transient STT errors surface as scary red banners even when the
   session auto-recovers (post STT-fix).

Scope: Listening Mode + Overlay get the deep pass. Chat + Setup get consistency
touch-ups only. Visual identity stays paper/ink/coral — refined, not replaced.

## 1. Scroll system — `useStickyScroll`

New hook `src/lib/useStickyScroll.ts` (~60 lines), used by all three scrollers
(transcript pane, coach pane, overlay feed). Replaces the three `scrollTo(1e9)`
effects in `ListeningMode.tsx`.

Behavior:
- **Pinned** = scroll position within 48px of the bottom. Content growth while
  pinned → instant (`behavior: "auto"`) scroll to bottom. Never `smooth` during
  streaming.
- User scrolls up past the threshold → unpinned; the pane stops following.
- New content while unpinned → small "↓ latest" pill floats at the pane's bottom
  edge. Click → jump to bottom and re-pin.
- Content growth detected via dependency (content length / turn count), not
  ResizeObserver — matches existing effect-driven pattern.

API: `const { ref, pinned, jumpToLatest } = useStickyScroll(deps)` — attach `ref`
to the scroll container; render the pill when `!pinned`.

## 2. Listening Mode visuals

The coach pane is the star; the transcript is reference.

- **Coach turns become quiet cards**: hairline `line` border, `paper-warm` fill,
  2px coral left rail, body text 13px → 14px, larger inter-turn spacing.
  Timestamps smaller/dimmer in the corner. All turns get the same card treatment
  (no unreliable answer-vs-feedback detection).
- **Streaming affordance**: three-dot bounce replaced with a subtle coral caret
  at the tail of streaming text.
- **Code blocks**: mono stack, `overflow-x-auto` containment inside the card,
  readable size (13px) — code is read live off this pane.
- **Transcript pane**: stays serif; contrast dropped slightly (ink-muted range)
  so it recedes behind the coach pane.
- **Status chip**: Live / Reconnecting / Error / Standby. "Reconnecting" shows
  when an STT error status arrives while the session is active and a restart is
  expected (error followed by re-open) — replaces the red banner for transient
  errors. Banner remains for hard failures (session not live).
- VU meter, nudge box, header layout: kept; focus/hover states sharpened.

## 3. Overlay mode

- Latest coach turn at full contrast; older turns compacted (smaller text,
  dimmed) so the newest answer dominates.
- Max text line-width capped (~65ch) for fast reading.
- Background opacity 85% → ~92% for readability over busy screen shares.
- Same "↓ latest" pill. Drag region and window sizing untouched (main-process
  overlay bounds are out of scope).

## 4. Chat + Setup consistency touch-ups

Class-level only, no layout changes: border radii, focus rings, and button
styles matched to the refreshed Listening screens where mismatch is visible.

## 5. QA + verification

No test framework exists in the repo; none is added days before the interview.
Verification checklist (all must pass before "done"):

- `tsc` (renderer + electron projects) and `vite build` clean.
- Code-review pass over renderer: scroll logic, streaming state updates
  (`onCoachDelta` reducer), overlay toggle state, unmount cleanup.
- Live app drive: coach turns streamed via whisper box (no mic needed);
  live-mic session for the STT path; pin/unpin during active streaming;
  overlay flip mid-stream; window resize; 50+-turn long-session simulation;
  error-state rendering (kill network briefly → status chip shows
  Reconnecting → Live).
- Every bug found is fixed and re-driven.

## Out of scope

- Component decomposition of `ListeningMode.tsx` (Approach B — deferred).
- Dark/stealth theme.
- Main-process window sizing/positioning changes.
- New test infrastructure.
