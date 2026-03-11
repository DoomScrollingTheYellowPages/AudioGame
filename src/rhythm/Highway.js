// ─────────────────────────────────────────────
// Highway — horizontal scrolling note renderer
// ─────────────────────────────────────────────
// Draws a piano-roll style highway on a canvas.
// Notes scroll right-to-left toward a hit zone
// on the left edge. Each natural note gets a lane.
// ─────────────────────────────────────────────

// Map MIDI pitch class → lane index (natural notes only)
const LANE_MAP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const LANE_LABELS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LANE_COUNT = 7;
const CHROMATIC = ['C', null, 'D', null, 'E', 'F', null, 'G', null, 'A', null, 'B'];

const HIT_ZONE_X = 80;        // pixels from left edge
const LOOK_AHEAD = 3000;      // ms of notes visible ahead
const PIXELS_PER_MS = 0.25;   // scroll speed (canvas pixels per ms)

const COLORS = {
  bg: '#0d0d0d',
  lane: '#141414',
  laneLine: '#1a1a1a',
  hitZone: '#333',
  hitZoneActive: '#00ff88',
  note: '#3a3a3a',
  noteUpcoming: '#555',
  perfect: '#00ff88',
  great: '#88cc44',
  good: '#ccaa22',
  miss: '#ff4444',
  label: '#444',
  labelActive: '#00ff88',
};

export class Highway {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(canvas, bus) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._bus = bus;
    this._noteStates = new Map(); // noteIndex → 'Perfect'|'Great'|'Good'|'miss'
    this._activeLanes = new Set(); // currently pressed lanes

    bus.on('hit:judge', ({ noteIndex, tier }) => {
      this._noteStates.set(noteIndex, tier);
    });
    bus.on('hit:miss', ({ noteIndex }) => {
      this._noteStates.set(noteIndex, 'miss');
    });
  }

  /** Mark a lane as actively pressed (for hit zone glow). */
  setLaneActive(letter, active) {
    if (active) this._activeLanes.add(letter);
    else this._activeLanes.delete(letter);
  }

  /**
   * Draw one frame.
   * @param {number} position  — current song time in ms
   * @param {Array} notes      — full note array from SongEngine
   */
  draw(position, notes) {
    const ctx = this._ctx;
    const W = this._canvas.width;
    const H = this._canvas.height;
    const laneH = H / LANE_COUNT;

    // ── Background ──
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Lane backgrounds + dividers ──
    for (let i = 0; i < LANE_COUNT; i++) {
      const y = i * laneH;
      ctx.fillStyle = i % 2 === 0 ? COLORS.lane : COLORS.bg;
      ctx.fillRect(HIT_ZONE_X, y, W - HIT_ZONE_X, laneH);

      // Divider line
      ctx.strokeStyle = COLORS.laneLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(HIT_ZONE_X, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // ── Lane labels (left side) ──
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < LANE_COUNT; i++) {
      const label = LANE_LABELS[i];
      ctx.fillStyle = this._activeLanes.has(label) ? COLORS.labelActive : COLORS.label;
      ctx.fillText(label, HIT_ZONE_X / 2, i * laneH + laneH / 2);
    }

    // ── Hit zone line ──
    ctx.strokeStyle = this._activeLanes.size > 0 ? COLORS.hitZoneActive : COLORS.hitZone;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(HIT_ZONE_X, 0);
    ctx.lineTo(HIT_ZONE_X, H);
    ctx.stroke();

    // ── Notes ──
    const pad = 3;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const letter = CHROMATIC[n.note % 12];
      if (!letter) continue;
      const lane = LANE_MAP[letter];
      if (lane === undefined) continue;

      // X position: note's time relative to hit zone
      const dx = n.time - position;
      if (dx > LOOK_AHEAD || dx + n.duration / (1 / PIXELS_PER_MS) < -500) continue;

      const x = HIT_ZONE_X + dx * PIXELS_PER_MS;
      const w = Math.max(n.duration * PIXELS_PER_MS, 8);
      const y = lane * laneH + pad;
      const h = laneH - pad * 2;

      // Color based on state
      const state = this._noteStates.get(i);
      if (state === 'Perfect') ctx.fillStyle = COLORS.perfect;
      else if (state === 'Great') ctx.fillStyle = COLORS.great;
      else if (state === 'Good') ctx.fillStyle = COLORS.good;
      else if (state === 'miss') ctx.fillStyle = COLORS.miss;
      else ctx.fillStyle = dx <= 0 ? COLORS.note : COLORS.noteUpcoming;

      // Draw rounded rect
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}
