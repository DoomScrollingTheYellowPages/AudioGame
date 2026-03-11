# AudioGame — Dev Notes & Ideas

<!-- ────────────────────────────────────────────────────────────────────────
  IDEAS: rough thoughts, not yet scoped or prioritised.
  Move items to CLAUDE.md once they become architectural decisions.
──────────────────────────────────────────────────────────────────────────── -->

<!-- ── Leaderboard / User Accounts ───────────────────────────────────────
  Context: zero-dependency static site on GitHub Pages — no backend today.

  Simplest path (local-only, no backend):
    - localStorage stores { username, passwordHash, highScores }
    - A manually curated public/leaderboard.json lives in the repo
    - No self-serve score submission; leaderboard updated via PR/commit

  Proper self-serve path (lightweight backend):
    - A single Vercel Function (~50 lines) acts as the trust boundary:
        POST /api/score  { username, password, game, score }
        → verifies password hash against users.json in the repo
        → if valid, updates high-scores.json via the GitHub Contents API
    - Browser keeps a session token in localStorage (no cookies needed)
    - Public leaderboard.json is fetched directly from the repo (raw URL)
    - Prevents spoofed submissions without a full auth service

  Creative no-backend alternative (GitHub Issues pipeline):
    - Score submission opens a pre-filled GitHub Issue
    - A GitHub Action parses the Issue body and updates leaderboard.json
    - Auditable and cheat-visible but clunky UX

  Verdict: start with local-only; add Vercel Function only when leaderboard
  becomes a real feature request.
──────────────────────────────────────────────────────────────────────────── -->

<!-- ── Tone.js — Web Audio framework (future composition/DAW features) ────
  https://tonejs.github.io/  |  MIT license  |  ~100kb

  What it adds over raw Web Audio API:
    - Transport clock with BPM, loop, swing — replaces our SongEngine rAF loop
    - Synths, samplers, effects chain (reverb, delay, chorus) out of the box
    - Sequencer (Tone.Sequence, Tone.Pattern) for pattern-based composition
    - Scheduled events synced to audio clock (not rAF), eliminating drift

  MIDI playback & UI sync:
    - Tone.Transport is audio-clock-based (more accurate than rAF)
    - Would solve MIDI timing sync more elegantly than countIn alignment
    - BUT: requires rewriting SongEngine + Highway renderers to use Tone events
    - Current rAF approach is simpler and sufficient for a music game

  When to adopt Tone.js:
    - Composition / piano-roll editor (multi-track sequencing)
    - Professional-grade timing (polyrhythms, swing, complex meters)
    - Real-time effects/filters (reverb, delay, EQ)
    - Multiple simultaneous instruments

  Current verdict: Keep rAF-based SongEngine + Synth.js for now.
  The zero-dependency constraint and simplicity outweigh Tone's benefits
  for an educational music game. Revisit if building composition features.

  Migration path (if needed):
    - Import via CDN ESM (preserves zero-dependency for base app)
    - Tone.Transport becomes the playback clock
    - MidiParser → Tone.Synth note scheduling
    - Highway/StaffHighway listen to Tone.Transport events
    - SongEngine becomes thin wrapper around Tone.Transport
──────────────────────────────────────────────────────────────────────────── -->
