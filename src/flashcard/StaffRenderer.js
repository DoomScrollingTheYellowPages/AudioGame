// ─────────────────────────────────────────────
// StaffRenderer.js
// Draws a treble-clef staff with a single note
// on an HTML5 Canvas element.
// ─────────────────────────────────────────────

// Treble clef note map: MIDI note → { name, letter, staffPos }
// staffPos: diatonic steps above E4 (bottom staff line)
//   0 = E4 (line 1 / bottom), 2 = G4 (line 2), 4 = B4 (line 3),
//   6 = D5 (line 4), 8 = F5 (line 5 / top)
//   negative = below bottom line, >8 = above top line
const NOTE_MAP = {
  60: { name: 'C4', letter: 'C', staffPos: -2 },  // first ledger below
  62: { name: 'D4', letter: 'D', staffPos: -1 },  // space below E4
  64: { name: 'E4', letter: 'E', staffPos:  0 },  // line 1
  65: { name: 'F4', letter: 'F', staffPos:  1 },  // space 1
  67: { name: 'G4', letter: 'G', staffPos:  2 },  // line 2
  69: { name: 'A4', letter: 'A', staffPos:  3 },  // space 2
  71: { name: 'B4', letter: 'B', staffPos:  4 },  // line 3 (middle)
  72: { name: 'C5', letter: 'C', staffPos:  5 },  // space 3
  74: { name: 'D5', letter: 'D', staffPos:  6 },  // line 4
  76: { name: 'E5', letter: 'E', staffPos:  7 },  // space 4
  77: { name: 'F5', letter: 'F', staffPos:  8 },  // line 5 (top)
  79: { name: 'G5', letter: 'G', staffPos:  9 },  // space above top
  81: { name: 'A5', letter: 'A', staffPos: 10 },  // first ledger above
};

export class StaffRenderer {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');

    // Layout constants
    this.LINE_SPACING = 20;     // px between adjacent staff lines
    this.HALF_STEP    = 10;     // px per diatonic step (half of line spacing)
    this.STAFF_TOP_Y  = 65;     // y of top staff line (F5)
    this.NOTE_X       = 310;    // x center of note head
    this.STAFF_LEFT   = 90;     // x where staff lines begin
    this.STAFF_RIGHT  = 460;    // x where staff lines end
    this.LEDGER_W     = 22;     // half-width of ledger lines
  }

  // Convert staffPos to canvas Y coordinate.
  // staffPos 0 (E4) = bottom line; positive = up.
  _staffY(staffPos) {
    const bottomLineY = this.STAFF_TOP_Y + 4 * this.LINE_SPACING;
    return bottomLineY - staffPos * this.HALF_STEP;
  }

  getNoteInfo(midiNote) {
    return NOTE_MAP[midiNote] ?? null;
  }

  // ── Public API ───────────────────────────────

  render(midiNote, state = 'normal') {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawStaff();
    this._drawClef();

    const info = this.getNoteInfo(midiNote);
    if (info) this._drawNote(info.staffPos, state);
  }

  renderEmpty() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawStaff();
    this._drawClef();
  }

  // ── Private drawing helpers ──────────────────

  _drawStaff() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#555';
    ctx.lineWidth   = 1.5;

    for (let i = 0; i < 5; i++) {
      const y = this.STAFF_TOP_Y + i * this.LINE_SPACING;
      ctx.beginPath();
      ctx.moveTo(this.STAFF_LEFT,  y);
      ctx.lineTo(this.STAFF_RIGHT, y);
      ctx.stroke();
    }
  }

  _drawClef() {
    const ctx = this.ctx;
    // The treble clef unicode glyph (U+1D11E) renders well in serif fonts.
    // It curls around the G line (staffPos 2, line 2) and extends below.
    ctx.fillStyle    = '#aaa';
    ctx.font         = '80px Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'alphabetic';
    // Anchor point aligns glyph bottom to just below the staff
    ctx.fillText('\u{1D11E}', this.STAFF_LEFT - 4, this._staffY(0) + 12);
  }

  _drawNote(staffPos, state) {
    const ctx   = this.ctx;
    const y     = this._staffY(staffPos);
    const stemUp = staffPos < 4; // stem up for notes on/below the middle line

    // Color by answer state
    const color = state === 'correct' ? '#00ff88'
                : state === 'wrong'   ? '#ff4444'
                :                       '#e0e0e0';

    // Ledger lines (drawn before note head so note sits on top)
    this._drawLedgerLines(staffPos, color);

    ctx.fillStyle   = color;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;

    // Note head — slightly tilted ellipse
    ctx.beginPath();
    ctx.ellipse(this.NOTE_X, y, 10, 7.5, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (stemUp) {
      ctx.moveTo(this.NOTE_X + 9,  y);
      ctx.lineTo(this.NOTE_X + 9,  y - 40);
    } else {
      ctx.moveTo(this.NOTE_X - 9,  y);
      ctx.lineTo(this.NOTE_X - 9,  y + 40);
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

    // Below the staff: ledger lines at staffPos -2, -4, …
    for (let pos = -2; pos >= staffPos; pos -= 2) draw(pos);

    // Above the staff: ledger lines at staffPos 10, 12, …
    for (let pos = 10; pos <= staffPos; pos += 2) draw(pos);
  }
}
