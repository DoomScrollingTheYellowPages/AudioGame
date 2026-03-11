// ─────────────────────────────────────────────
// HitJudge — timing & scoring for music game
// ─────────────────────────────────────────────
// Maintains a queue of upcoming notes and judges
// player input against the nearest expected note.
//
// Emits via EventBus:
//   'hit:judge'  { noteIndex, tier, points, combo, delta }
//   'hit:miss'   { noteIndex }
// ─────────────────────────────────────────────

const TIERS = [
  { name: 'Perfect', window: 50,  points: 100 },
  { name: 'Great',   window: 100, points: 75  },
  { name: 'Good',    window: 200, points: 50  },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class HitJudge {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('./SongEngine.js').SongEngine} engine
   */
  constructor(bus, engine) {
    this._bus = bus;
    this._engine = engine;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hits = 0;
    this.misses = 0;
    this.tierCounts = { Perfect: 0, Great: 0, Good: 0, Miss: 0 };

    // Track which notes have been judged (by index)
    this._judged = new Set();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hits = 0;
    this.misses = 0;
    this.tierCounts = { Perfect: 0, Great: 0, Good: 0, Miss: 0 };
    this._judged = new Set();
  }

  /**
   * Convert MIDI note number to its pitch name (e.g. 'C', 'C#', 'D#').
   * @param {number} midiNote
   * @returns {string}
   */
  pitchName(midiNote) {
    return NOTE_NAMES[midiNote % 12];
  }

  /**
   * Player hit a note — find the closest unjudged note matching this pitch.
   * @param {string} noteName  — e.g. 'C', 'C#', 'D#'
   */
  judge(noteName) {
    const pos = this._engine.position;
    const notes = this._engine.notes;
    let bestIdx = -1;
    let bestDelta = Infinity;

    for (let i = 0; i < notes.length; i++) {
      if (this._judged.has(i)) continue;
      const n = notes[i];
      const nName = this.pitchName(n.note);
      if (nName !== noteName) continue;

      const delta = Math.abs(pos - n.time);
      // Only consider notes within the largest window
      if (delta < bestDelta && delta <= TIERS[TIERS.length - 1].window) {
        bestDelta = delta;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) return; // no matching note nearby

    this._judged.add(bestIdx);
    const delta = pos - notes[bestIdx].time;

    // Determine tier
    const absDelta = Math.abs(delta);
    let tier = null;
    for (const t of TIERS) {
      if (absDelta <= t.window) {
        tier = t;
        break;
      }
    }

    if (tier) {
      this.combo++;
      this.hits++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const multiplier = Math.min(4, 1 + Math.floor(this.combo / 10));
      const points = tier.points * multiplier;
      this.score += points;
      this.tierCounts[tier.name]++;

      this._bus.emit('hit:judge', {
        noteIndex: bestIdx,
        tier: tier.name,
        points,
        combo: this.combo,
        delta,
      });
    }
  }

  /**
   * Called each frame to check for missed notes (past the window).
   */
  checkMisses(position) {
    const notes = this._engine.notes;
    const maxWindow = TIERS[TIERS.length - 1].window;

    for (let i = 0; i < notes.length; i++) {
      if (this._judged.has(i)) continue;
      if (position - notes[i].time > maxWindow) {
        this._judged.add(i);
        this.combo = 0;
        this.misses++;
        this.tierCounts.Miss++;
        this._bus.emit('hit:miss', { noteIndex: i });
      }
    }
  }

  get totalNotes() {
    return this._engine.notes.length;
  }

  get accuracy() {
    const total = this.hits + this.misses;
    return total > 0 ? Math.round((this.hits / total) * 100) : 0;
  }

  isJudged(index) {
    return this._judged.has(index);
  }
}
