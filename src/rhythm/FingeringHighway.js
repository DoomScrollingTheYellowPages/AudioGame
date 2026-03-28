// ─────────────────────────────────────────────
// FingeringHighway.js
// MidiHero view: scrolling oboe fingering cards.
// Notes appear as mini fingering diagrams instead of
// piano-roll rectangles.  No staff lines — beat and bar
// markers are retained.  Same public interface as Highway.
// ─────────────────────────────────────────────

import { getPrimaryFingering } from '../fingering/OboeFingeringData.js';
import { getNoteInfo }         from '../core/NoteInfo.js';
import { Theme }               from '../core/Theme.js';

// ── Scroll / timing (must match Highway constants) ──
const HIT_ZONE_X    = 80;
const LOOK_AHEAD    = 3000;
const PIXELS_PER_MS = 0.25;

// ── Mini-card layout (800 × 360 canvas) ──────────────
const CARD_H    = 148;                          // card height
const CARD_W    = 46;                           // horizontal extent (incl. side keys)
const CARD_TOP  = Math.round((360 - CARD_H) / 2);  // 106
const CARD_BOT  = CARD_TOP + CARD_H;               // 254

const BODY_W    = 10;   // instrument body width
const BODY_Y1   = CARD_TOP + 12;
const BODY_Y2   = CARD_TOP + 138;

const HOLE_R    = 5;    // main hole radius
const KEY_R     = 3.5;  // small key radius

// Hole y-positions (absolute canvas y)
const HOLE_Y = {
  l1: CARD_TOP + 25,
  l2: CARD_TOP + 44,
  l3: CARD_TOP + 63,
  r1: CARD_TOP + 83,
  r2: CARD_TOP + 102,
  r3: CARD_TOP + 121,
};

// Side-key positions: (xOffset from note-cx, absolute y)
const KEY_POS = {
  oct:   { dx: -(BODY_W / 2 + KEY_R + 2), y: CARD_TOP + 17 },
  lSide: { dx: -(BODY_W / 2 + KEY_R + 2), y: CARD_TOP + 63 },
  rSide: { dx:  (BODY_W / 2 + KEY_R + 2), y: CARD_TOP + 83 },
  lowBb: { dx:  (BODY_W / 2 + KEY_R + 2), y: CARD_TOP + 121 },
};

function getColors() {
  const t = Theme.current();
  return {
    bg: t.bg,
    cardBg: t.laneBg,
    cardBorder: t.laneLine,
    body: t.controlBg,
    bodyBorder: t.controlBorder,
    holeOpen: t.bg,
    holeBorder: t.controlBorder,
    holeClosed: t.accent,
    keyOpen: t.bg,
    keyBorder: t.controlBorder,
    octClosed: '#00aaff',
    sideClosed: '#ffaa00',
    text: t.text,
    noteNameHit: t.accent,
    noteNameMiss: t.dimText,
    hitZoneActive: t.hitZoneActive,
    beatLine: t.beatLine,
    barLine: t.barLine,
    dimText: t.dimText,
    perfect: t.perfect,
    great: t.great,
    good: t.good,
    miss: t.miss,
  };
}

export class FingeringHighway {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(canvas, bus) {
    this._canvas      = canvas;
    this._ctx         = canvas.getContext('2d');
    this._bus         = bus;
    this._noteStates  = new Map();
    this._activeLanes = new Set();

    this._bpm     = 120;
    this._meter   = [4, 4];
    this._countIn = 2000;

    bus.on('hit:judge', ({ noteIndex, tier }) => this._noteStates.set(noteIndex, tier));
    bus.on('hit:miss',  ({ noteIndex })        => this._noteStates.set(noteIndex, 'miss'));
  }

  /** @param {number} bpm @param {Array} meter @param {number} countIn */
  setSongInfo(bpm, meter, countIn) {
    this._bpm     = bpm;
    this._meter   = meter || [4, 4];
    this._countIn = countIn || 2000;
  }

  /** @param {string} noteName @param {boolean} active */
  setLaneActive(noteName, active) {
    if (active) this._activeLanes.add(noteName);
    else        this._activeLanes.delete(noteName);
  }

  /**
   * Draw one frame.
   * @param {number} position  current song time in ms
   * @param {Array}  notes     full note array from SongEngine
   */
  draw(position, notes) {
    const COLORS = getColors();
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;

    // ── Background ──
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Beat / bar lines ──
    this._drawBeatLines(ctx, position, W, H);

    // ── Hit zone ──
    ctx.strokeStyle = this._activeLanes.size > 0 ? COLORS.hitZoneActive : COLORS.dimText;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(HIT_ZONE_X, 0);
    ctx.lineTo(HIT_ZONE_X, H);
    ctx.stroke();

    // ── Fingering cards (sort so earlier notes draw behind later ones) ──
    for (let i = 0; i < notes.length; i++) {
      const n  = notes[i];
      const dx = n.time - position;
      if (dx > LOOK_AHEAD) continue;
      if (dx < -400)       continue;   // well past hit zone

      const cx = HIT_ZONE_X + dx * PIXELS_PER_MS;
      if (cx + CARD_W / 2 < 0 || cx - CARD_W / 2 > W) continue;

      const state = this._noteStates.get(i) ?? null;
      this._drawCard(ctx, cx, n.note, state);
    }

    // ── Active-lane label strip (left of hit zone) ──
    if (this._activeLanes.size > 0) {
      ctx.fillStyle    = COLORS.noteNameHit;
      ctx.font         = 'bold 11px "Courier New", monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      const names = [...this._activeLanes].join(' ');
      ctx.fillText(names, HIT_ZONE_X / 2, H / 2);
    }
  }

  // ── Private ──────────────────────────────────────────

  _drawCard(ctx, cx, midiNote, hitState) {
    const COLORS = getColors();
    const f    = getPrimaryFingering(midiNote);
    const info = getNoteInfo(midiNote);

    // Card background
    const bx = cx - CARD_W / 2;
    ctx.fillStyle   = COLORS.cardBg;
    ctx.strokeStyle = COLORS.cardBorder;
    ctx.lineWidth   = 1;
    this._roundRect(ctx, bx, CARD_TOP, CARD_W, CARD_H, 4);

    // Hit-state tint
    if (hitState) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle   = hitState === 'Perfect' ? COLORS.perfect
                      : hitState === 'Great'   ? COLORS.great
                      : hitState === 'Good'    ? COLORS.good
                      :                          COLORS.miss;
      ctx.fillRect(bx, CARD_TOP, CARD_W, CARD_H);
      ctx.restore();
    }

    if (!f) {
      this._drawLabel(ctx, cx, info.name, hitState);
      return;
    }

    // Instrument body
    ctx.fillStyle   = COLORS.body;
    ctx.strokeStyle = COLORS.bodyBorder;
    ctx.lineWidth   = 1;
    this._roundRect(ctx, cx - BODY_W / 2, BODY_Y1, BODY_W, BODY_Y2 - BODY_Y1, 3);

    // Octave key
    this._drawKey(ctx, cx + KEY_POS.oct.dx, KEY_POS.oct.y, KEY_R,
      f.oct ? COLORS.octClosed : COLORS.keyOpen,
      f.oct ? COLORS.octClosed : COLORS.keyBorder);

    // Six main holes
    const holePairs = [
      [HOLE_Y.l1, f.l1], [HOLE_Y.l2, f.l2], [HOLE_Y.l3, f.l3],
      [HOLE_Y.r1, f.r1], [HOLE_Y.r2, f.r2], [HOLE_Y.r3, f.r3],
    ];
    for (const [y, pressed] of holePairs) {
      this._drawHole(ctx, cx, y, HOLE_R, pressed);
    }

    // Side keys
    this._drawKey(ctx, cx + KEY_POS.lSide.dx, KEY_POS.lSide.y, KEY_R,
      f.lSide ? COLORS.sideClosed : COLORS.keyOpen,
      f.lSide ? COLORS.sideClosed : COLORS.keyBorder);
    this._drawKey(ctx, cx + KEY_POS.rSide.dx, KEY_POS.rSide.y, KEY_R,
      f.rSide ? COLORS.sideClosed : COLORS.keyOpen,
      f.rSide ? COLORS.sideClosed : COLORS.keyBorder);
    this._drawKey(ctx, cx + KEY_POS.lowBb.dx, KEY_POS.lowBb.y, KEY_R,
      f.lowBb ? COLORS.sideClosed : COLORS.keyOpen,
      f.lowBb ? COLORS.sideClosed : COLORS.keyBorder);

    this._drawLabel(ctx, cx, info.name, hitState);
  }

  _drawLabel(ctx, cx, name, hitState) {
    const COLORS = getColors();
    ctx.fillStyle    = hitState ? COLORS.noteNameHit : COLORS.noteNameMiss;
    ctx.font         = '8px "Courier New", monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(name, cx, CARD_BOT + 4);
  }

  _drawHole(ctx, x, y, r, pressed) {
    const COLORS = getColors();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = pressed ? COLORS.holeClosed : COLORS.holeOpen;
    ctx.strokeStyle = COLORS.holeBorder;
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
  }

  _drawKey(ctx, x, y, r, fill, border) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
  }

  _roundRect(ctx, x, y, w, h, r) {
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
    ctx.stroke();
  }

  _drawBeatLines(ctx, position, W, H) {
    const COLORS = getColors();
    const msPerBeat   = 60000 / this._bpm;
    const beatsPerBar = this._meter[0];
    const minTime     = position - 200;
    const maxTime     = position + LOOK_AHEAD;
    const firstBeat   = Math.max(0, Math.floor(minTime / msPerBeat));
    const lastBeat    = Math.ceil(maxTime / msPerBeat);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = '9px "Courier New", monospace';

    for (let b = firstBeat; b <= lastBeat; b++) {
      const x = HIT_ZONE_X + (b * msPerBeat - position) * PIXELS_PER_MS;
      if (x < HIT_ZONE_X || x > W) continue;

      const isBarLine = b % beatsPerBar === 0;
      ctx.strokeStyle = isBarLine ? COLORS.barLine  : COLORS.beatLine;
      ctx.lineWidth   = isBarLine ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      if (isBarLine) {
        const bar           = Math.floor(b / beatsPerBar);
        const countInBeats  = Math.ceil(this._countIn / msPerBeat);
        const displayBar    = bar - Math.floor(countInBeats / beatsPerBar) + 1;
        if (displayBar >= 1) {
          ctx.fillStyle = COLORS.dimText;
          ctx.fillText(`${displayBar}`, x, 3);
        }
      }
    }
  }
}
