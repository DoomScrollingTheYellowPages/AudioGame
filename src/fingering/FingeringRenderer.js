// ─────────────────────────────────────────────
// FingeringRenderer.js
// Canvas renderer for simplified oboe fingering diagrams.
// Draws a vertical instrument body with 6 main holes,
// an octave key, and side keys.
// Drop-in compatible with StaffRenderer (render / getNoteInfo).
// ─────────────────────────────────────────────

import { getPrimaryFingering }  from './OboeFingeringData.js';
import { getNoteInfo }         from '../core/NoteInfo.js';
import { Theme }               from '../core/Theme.js';

function getColors() {
  const t = Theme.current();
  return {
    bg:         t.bg,
    body:       t.controlBg,
    bodyBorder: t.controlBorder,
    holeOpen:   t.bg,
    holeBorder: '#555',
    holeClosed: t.accent,
    keyOpen:    t.bg,
    keyBorder:  '#444',
    octClosed:  '#00aaff',
    sideClosed: '#ffaa00',
    handLabel:  t.dimText,
    dimText:    t.dimText,
    text:       t.text,
  };
}

// ── Canvas dimensions for fingering mode ──────
export const FINGERING_W = 560;
export const FINGERING_H = 280;

// ── Instrument layout (all coords for 560×280) ─
const CX      = 280;   // horizontal centre
const BODY_Y1 = 20;
const BODY_Y2 = 260;
const BODY_W  = 24;
const HOLE_R  = 13;    // main hole radius
const KEY_R   = 8;     // small key radius

// Y positions of the 6 main holes
const HOLE_Y = { l1: 66, l2: 104, l3: 142, r1: 178, r2: 212, r3: 246 };

// (x, y) of small keys
const KEY_XY = {
  oct:   { x: CX - 24, y: 36 },   // octave key — left of body, top
  lSide: { x: CX - 24, y: 142 },  // left side key (Eb/G#/B) — left of L3
  rSide: { x: CX + 24, y: 178 },  // right side key (C#/F/Bb) — right of R1
  lowBb: { x: CX + 24, y: 246 },  // low Bb key — right of R3
};

export class FingeringRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');
  }

  /**
   * Draw the oboe fingering for a MIDI note.
   * @param {number} midiNote
   * @param {'normal'|'correct'|'wrong'} state
   */
  render(midiNote, state = 'normal') {
    const COLORS = getColors();
    const f   = getPrimaryFingering(midiNote);
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    if (!f) return;

    // ── Instrument body ──────────────────────────────────
    ctx.fillStyle   = COLORS.body;
    ctx.strokeStyle = COLORS.bodyBorder;
    ctx.lineWidth   = 1.5;
    this._roundRect(CX - BODY_W / 2, BODY_Y1, BODY_W, BODY_Y2 - BODY_Y1, 7);

    // ── Dividing line between hands ───────────────────────
    const gapY = (HOLE_Y.l3 + HOLE_Y.r1) / 2;
    ctx.strokeStyle = COLORS.bodyBorder;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(CX - BODY_W / 2 - 20, gapY);
    ctx.lineTo(CX + BODY_W / 2 + 20, gapY);
    ctx.stroke();

    // ── Octave key ────────────────────────────────────────
    this._drawKey(
      KEY_XY.oct.x, KEY_XY.oct.y, KEY_R,
      f.oct ? COLORS.octClosed : COLORS.keyOpen,
      f.oct ? COLORS.octClosed : COLORS.keyBorder,
    );

    // ── Six main holes ────────────────────────────────────
    const holePairs = [
      [HOLE_Y.l1, f.l1], [HOLE_Y.l2, f.l2], [HOLE_Y.l3, f.l3],
      [HOLE_Y.r1, f.r1], [HOLE_Y.r2, f.r2], [HOLE_Y.r3, f.r3],
    ];
    for (const [y, pressed] of holePairs) {
      this._drawHole(CX, y, HOLE_R, pressed);
    }

    // ── Side keys (always drawn; filled when active) ──────
    this._drawKey(
      KEY_XY.lSide.x, KEY_XY.lSide.y, KEY_R,
      f.lSide ? COLORS.sideClosed : COLORS.keyOpen,
      f.lSide ? COLORS.sideClosed : COLORS.keyBorder,
    );
    this._drawKey(
      KEY_XY.rSide.x, KEY_XY.rSide.y, KEY_R,
      f.rSide ? COLORS.sideClosed : COLORS.keyOpen,
      f.rSide ? COLORS.sideClosed : COLORS.keyBorder,
    );
    this._drawKey(
      KEY_XY.lowBb.x, KEY_XY.lowBb.y, KEY_R,
      f.lowBb ? COLORS.sideClosed : COLORS.keyOpen,
      f.lowBb ? COLORS.sideClosed : COLORS.keyBorder,
    );

    // ── Hand labels ───────────────────────────────────────
    ctx.font         = '9px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'right';
    ctx.fillStyle    = COLORS.handLabel;
    ctx.fillText('L', CX - BODY_W / 2 - 12, (HOLE_Y.l1 + HOLE_Y.l3) / 2);
    ctx.fillText('R', CX - BODY_W / 2 - 12, (HOLE_Y.r1 + HOLE_Y.r3) / 2);

    // ── Instrument watermark ──────────────────────────────
    ctx.fillStyle    = COLORS.dimText;
    ctx.font         = '9px "Courier New", monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('OBOE', W - 12, H - 6);

    // ── Correct / Wrong state overlay ─────────────────────
    if (state !== 'normal') {
      ctx.save();
      ctx.globalAlpha = 0.07;
      const t = Theme.current();
      ctx.fillStyle   = state === 'correct' ? t.accent : t.error;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /**
   * Duck-type compatible with StaffRenderer.getNoteInfo.
   * Returns the canonical NoteInfo from core.
   * @param {number} midiNote
   * @returns {import('../core/NoteInfo.js').NoteInfo}
   */
  getNoteInfo(midiNote) {
    return getNoteInfo(midiNote);
  }

  // ── Private helpers ──────────────────────────

  _drawHole(x, y, r, pressed, COLORS) {
    if (!COLORS) COLORS = getColors();
    const ctx = this._ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = pressed ? COLORS.holeClosed : COLORS.holeOpen;
    ctx.strokeStyle = COLORS.holeBorder;
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
  }

  _drawKey(x, y, r, fill, border) {
    const ctx = this._ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this._ctx;
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
}
