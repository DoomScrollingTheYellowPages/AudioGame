// ─────────────────────────────────────────────
// StaffRenderer.js
// Draws a treble or bass clef staff with a single
// note on an HTML5 Canvas element.
// Supports all 12 chromatic tones.
// ─────────────────────────────────────────────

import { getNoteInfo } from '../core/NoteInfo.js';
import { Theme } from '../core/Theme.js';

export class StaffRenderer {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');

    this.LINE_SPACING = 20;
    this.HALF_STEP    = 10;
    this.STAFF_TOP_Y  = 65;
    this.NOTE_X       = 310;
    this.STAFF_LEFT   = 90;
    this.STAFF_RIGHT  = 460;
    this.LEDGER_W     = 22;
  }

  // staffPos 0 = bottom line; positive = up.
  _staffY(staffPos) {
    const bottomLineY = this.STAFF_TOP_Y + 4 * this.LINE_SPACING;
    return bottomLineY - staffPos * this.HALF_STEP;
  }

  /**
   * Return NoteInfo for any MIDI note.
   * Delegates to the canonical core getNoteInfo.
   */
  getNoteInfo(midiNote) {
    return getNoteInfo(midiNote);
  }

  /** Which clef does this MIDI note belong to? */
  clefFor(midiNote) {
    return getNoteInfo(midiNote).clef;
  }

  // ── Public API ───────────────────────────────

  render(midiNote, state = 'normal') {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawStaff();

    if (midiNote >= 60) {
      this._drawTrebleClef();
    } else {
      this._drawBassClef();
    }

    const { staffPos, sharp } = getNoteInfo(midiNote);
    this._drawNote(staffPos, sharp, state);
  }

  renderEmpty(clef = 'treble') {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawStaff();
    if (clef === 'bass') {
      this._drawBassClef();
    } else {
      this._drawTrebleClef();
    }
  }

  // ── Private drawing helpers ──────────────────

  _drawStaff() {
    const ctx = this.ctx;
    ctx.strokeStyle = Theme.current().dimText;
    ctx.lineWidth   = 1.5;
    for (let i = 0; i < 5; i++) {
      const y = this.STAFF_TOP_Y + i * this.LINE_SPACING;
      ctx.beginPath();
      ctx.moveTo(this.STAFF_LEFT,  y);
      ctx.lineTo(this.STAFF_RIGHT, y);
      ctx.stroke();
    }
  }

  _drawTrebleClef() {
    const ctx = this.ctx;
    ctx.fillStyle    = Theme.current().mid || '#aaa';
    ctx.font         = '80px Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('\u{1D11E}', this.STAFF_LEFT - 4, this._staffY(0) + 12);
  }

  _drawBassClef() {
    const ctx = this.ctx;
    ctx.fillStyle    = Theme.current().mid || '#aaa';
    ctx.font         = '44px Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'alphabetic';
    // Anchor so the glyph's F-line marker aligns with staffPos 6 (F3 = 4th line)
    ctx.fillText('\u{1D122}', this.STAFF_LEFT + 4, this._staffY(6) + 4);
  }

  _drawNote(staffPos, sharp, state) {
    const ctx    = this.ctx;
    const y      = this._staffY(staffPos);
    const stemUp = staffPos < 4;

    const t = Theme.current();
    const color = state === 'correct' ? t.accent
                : state === 'wrong'   ? t.error
                :                       t.text;

    this._drawLedgerLines(staffPos, color);

    // Sharp sign (♯) to the left of the note head
    if (sharp) {
      ctx.fillStyle    = color;
      ctx.font         = '22px Georgia, "Times New Roman", serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u266F', this.NOTE_X - 22, y);
    }

    ctx.fillStyle   = color;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;

    ctx.beginPath();
    ctx.ellipse(this.NOTE_X, y, 10, 7.5, -0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.beginPath();
    if (stemUp) {
      ctx.moveTo(this.NOTE_X + 9, y);
      ctx.lineTo(this.NOTE_X + 9, y - 40);
    } else {
      ctx.moveTo(this.NOTE_X - 9, y);
      ctx.lineTo(this.NOTE_X - 9, y + 40);
    }
    ctx.stroke();
  }

  _drawLedgerLines(staffPos, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;

    const draw = (pos) => {
      const y = this._staffY(pos);
      ctx.beginPath();
      ctx.moveTo(this.NOTE_X - this.LEDGER_W, y);
      ctx.lineTo(this.NOTE_X + this.LEDGER_W, y);
      ctx.stroke();
    };

    // Below the staff: ledger lines at -2, -4, …
    for (let pos = -2; pos >= staffPos; pos -= 2) draw(pos);

    // Above the staff: ledger lines at 10, 12, …
    for (let pos = 10; pos <= staffPos; pos += 2) draw(pos);
  }
}
