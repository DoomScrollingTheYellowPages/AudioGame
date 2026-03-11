// ─────────────────────────────────────────────
// StaffHighway — grand staff notation highway
// ─────────────────────────────────────────────
// Renders a scrolling grand staff (treble + bass clef).
// Notes appear as filled ovals on the correct line/space
// and scroll right-to-left toward a hit zone, just like
// the piano Highway but using standard music notation.
//
// Coordinate system — diatonic position d:
//   Each integer = one diatonic half-step (line ↔ space).
//   E4 (MIDI 64) = d 30, canvas y = REF_Y.
//   yOf(d) = REF_Y − (d − REF_D) × STEP_PX
//
// Grand-staff layout (canvas 800 × 280, STEP_PX = 8):
//   Treble: F5(d38,y60) D5(76) B4(92) G4(108) E4(124)
//   Middle C ledger:     C4(d28, y=140)
//   Bass:   A3(d26,y156) F3(172) D3(188) B2(204) G2(220)
// ─────────────────────────────────────────────

const HIT_ZONE_X    = 80;
const LOOK_AHEAD    = 3000;    // ms of notes visible ahead
const PIXELS_PER_MS = 0.25;    // same scroll speed as Highway

// ── Pitch → diatonic position ─────────────────
// Natural pitch classes → diatonic scale step within octave (0=C … 6=B)
const PC_TO_STEP = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

// Reference anchor: E4 (MIDI 64) → diatonic 30, canvas y 124
const REF_D   = 30;
const REF_Y   = 124;
const STEP_PX = 8;   // px per diatonic step (line→space or space→line)

// Staff line diatonic positions
const TREBLE_D = [30, 32, 34, 36, 38];   // E4 G4 B4 D5 F5
const BASS_D   = [18, 20, 22, 24, 26];   // G2 B2 D3 F3 A3
const MIDDLE_C_D = 28;                    // C4 — ledger between staves

// ── Colors ────────────────────────────────────
const C = {
  bg:            '#0d0d0d',
  staffLine:     '#484848',
  hitZone:       '#333',
  hitZoneActive: '#00ff88',
  clef:          '#888',
  noteFuture:    '#aaa',
  notePast:      '#444',
  ledger:        '#888',
  perfect:       '#00ff88',
  great:         '#88cc44',
  good:          '#ccaa22',
  miss:          '#ff4444',
  activeGlow:    'rgba(0,255,136,0.3)',
};

// Note head dimensions
const NH_RX = 10;    // horizontal radius
const NH_RY = 6.5;   // vertical radius
const STEM_LEN = 38; // stem length in px

// ── Helpers ───────────────────────────────────
/** Convert a natural MIDI note to its diatonic position d. Returns null for accidentals. */
function diatonicOf(midi) {
  const step = PC_TO_STEP[midi % 12];
  if (step === undefined) return null;
  const octave = Math.floor(midi / 12) - 1;
  return octave * 7 + step;
}

/** Map diatonic position to canvas Y. */
function yOf(d) {
  return REF_Y - (d - REF_D) * STEP_PX;
}

export class StaffHighway {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(canvas, bus) {
    this._canvas      = canvas;
    this._ctx         = canvas.getContext('2d');
    this._noteStates  = new Map();   // noteIndex → tier | 'miss'
    this._activeLanes = new Set();   // pressed note letters (C D E F G A B)

    bus.on('hit:judge', ({ noteIndex, tier }) => this._noteStates.set(noteIndex, tier));
    bus.on('hit:miss',  ({ noteIndex })        => this._noteStates.set(noteIndex, 'miss'));
  }

  /** Called by rhythm-main when a key / MIDI note is pressed. */
  setLaneActive(letter, active) {
    if (active) this._activeLanes.add(letter);
    else        this._activeLanes.delete(letter);
  }

  /**
   * Draw one frame.
   * @param {number} position  — current song time in ms
   * @param {Array}  notes     — full note array from SongEngine
   */
  draw(position, notes) {
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;

    // ── Background ──────────────────────────────
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Staff lines (full width, drawn behind everything) ──
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = C.staffLine;
    for (const d of [...TREBLE_D, ...BASS_D]) {
      const y = yOf(d);
      ctx.beginPath();
      ctx.moveTo(4, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // ── Brace / bar line on far left ────────────
    const topY    = yOf(TREBLE_D[TREBLE_D.length - 1]);
    const bottomY = yOf(BASS_D[0]);
    ctx.strokeStyle = C.staffLine;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(3, topY - 2);
    ctx.lineTo(3, bottomY + 2);
    ctx.stroke();

    // ── Hit zone line ────────────────────────────
    const anyActive = this._activeLanes.size > 0;
    ctx.strokeStyle = anyActive ? C.hitZoneActive : C.hitZone;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(HIT_ZONE_X, 0);
    ctx.lineTo(HIT_ZONE_X, H);
    ctx.stroke();

    // Active lane glow — radial bursts at each pressed note's y position
    if (anyActive) {
      for (const letter of this._activeLanes) {
        const refMidi = { C:60, D:62, E:64, F:65, G:67, A:69, B:71 }[letter];
        if (!refMidi) continue;
        const d = diatonicOf(refMidi);
        if (d === null) continue;
        const gy = yOf(d);
        const grad = ctx.createRadialGradient(HIT_ZONE_X, gy, 0, HIT_ZONE_X, gy, 28);
        grad.addColorStop(0, 'rgba(0,255,136,0.35)');
        grad.addColorStop(1, 'rgba(0,255,136,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(HIT_ZONE_X, gy, 28, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Clef panel (opaque bg to mask staff lines behind clefs) ──
    ctx.fillStyle = C.bg;
    ctx.fillRect(4, 0, HIT_ZONE_X - 4, H);

    // Re-draw staff lines through clef panel
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = C.staffLine;
    for (const d of [...TREBLE_D, ...BASS_D]) {
      const y = yOf(d);
      ctx.beginPath();
      ctx.moveTo(4, y);
      ctx.lineTo(HIT_ZONE_X, y);
      ctx.stroke();
    }

    // Treble clef glyph — anchor bottom near E4 line
    ctx.fillStyle    = C.clef;
    ctx.font         = '72px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('\u{1D11E}', HIT_ZONE_X / 2 - 2, yOf(REF_D) + 14);

    // Bass clef glyph — anchor near F3 line (d=24)
    ctx.font         = '44px serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('\u{1D122}', HIT_ZONE_X / 2 + 2, yOf(24) + 2);

    // ── Notes ────────────────────────────────────
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const d = diatonicOf(n.note);
      if (d === null) continue;

      const dx = n.time - position;
      if (dx > LOOK_AHEAD || dx < -600) continue;

      const cx = HIT_ZONE_X + dx * PIXELS_PER_MS;
      const ny = yOf(d);

      // Color
      const state = this._noteStates.get(i);
      let color;
      if      (state === 'Perfect') color = C.perfect;
      else if (state === 'Great')   color = C.great;
      else if (state === 'Good')    color = C.good;
      else if (state === 'miss')    color = C.miss;
      else                          color = dx <= 0 ? C.notePast : C.noteFuture;

      // Sustain tail
      const tailPx = n.duration * PIXELS_PER_MS - NH_RX;
      if (tailPx > 4) {
        ctx.strokeStyle  = color;
        ctx.lineWidth    = 3;
        ctx.globalAlpha  = 0.4;
        ctx.beginPath();
        ctx.moveTo(cx + NH_RX, ny);
        ctx.lineTo(cx + NH_RX + tailPx, ny);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Ledger lines (behind note head)
      this._drawLedgerLines(ctx, cx, d, color);

      // Note head
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, ny, NH_RX, NH_RY, -0.18, 0, Math.PI * 2);
      ctx.fill();

      // Stem — up for bass-range notes (d < 31), down for treble-range (d >= 31)
      const stemUp = d < 31;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      if (stemUp) {
        ctx.moveTo(cx + NH_RX - 1, ny);
        ctx.lineTo(cx + NH_RX - 1, ny - STEM_LEN);
      } else {
        ctx.moveTo(cx - NH_RX + 1, ny);
        ctx.lineTo(cx - NH_RX + 1, ny + STEM_LEN);
      }
      ctx.stroke();
    }
  }

  // ── Ledger line logic ─────────────────────────
  _drawLedgerLines(ctx, cx, d, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    const lw = NH_RX + 6;  // ledger line extends beyond note head

    const drawAt = (ld) => {
      const ly = yOf(ld);
      ctx.beginPath();
      ctx.moveTo(cx - lw, ly);
      ctx.lineTo(cx + lw, ly);
      ctx.stroke();
    };

    // Middle C (d=28) — always gets a ledger line
    if (d === MIDDLE_C_D) {
      drawAt(MIDDLE_C_D);
      return;
    }

    // Above treble staff top (F5, d=38)
    if (d > 38) {
      for (let ld = 40; ld <= d; ld += 2) drawAt(ld);
      return;
    }

    // Below bass staff bottom (G2, d=18)
    if (d < 18) {
      for (let ld = 16; ld >= d; ld -= 2) drawAt(ld);
    }
  }
}
