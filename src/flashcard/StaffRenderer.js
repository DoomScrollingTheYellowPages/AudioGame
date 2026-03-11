// ─────────────────────────────────────────────
// StaffRenderer.js
// Draws a treble or bass clef staff with a single
// note on an HTML5 Canvas element.
// Supports all 12 chromatic tones.
// ─────────────────────────────────────────────

// ── Treble clef note map (MIDI 60–82) ─────────
// staffPos: diatonic steps above E4 (bottom treble line)
//   0 = E4 (line 1), 2 = G4, 4 = B4, 6 = D5, 8 = F5 (line 5 / top)
//   negative = below staff, >8 = above staff
const TREBLE_NOTE_MAP = {
  60: { name: 'C4',  letter: 'C',   staffPos: -2, sharp: false },
  61: { name: 'C♯4', letter: 'C#',  staffPos: -2, sharp: true  },
  62: { name: 'D4',  letter: 'D',   staffPos: -1, sharp: false },
  63: { name: 'D♯4', letter: 'D#',  staffPos: -1, sharp: true  },
  64: { name: 'E4',  letter: 'E',   staffPos:  0, sharp: false },
  65: { name: 'F4',  letter: 'F',   staffPos:  1, sharp: false },
  66: { name: 'F♯4', letter: 'F#',  staffPos:  1, sharp: true  },
  67: { name: 'G4',  letter: 'G',   staffPos:  2, sharp: false },
  68: { name: 'G♯4', letter: 'G#',  staffPos:  2, sharp: true  },
  69: { name: 'A4',  letter: 'A',   staffPos:  3, sharp: false },
  70: { name: 'A♯4', letter: 'A#',  staffPos:  3, sharp: true  },
  71: { name: 'B4',  letter: 'B',   staffPos:  4, sharp: false },
  72: { name: 'C5',  letter: 'C',   staffPos:  5, sharp: false },
  73: { name: 'C♯5', letter: 'C#',  staffPos:  5, sharp: true  },
  74: { name: 'D5',  letter: 'D',   staffPos:  6, sharp: false },
  75: { name: 'D♯5', letter: 'D#',  staffPos:  6, sharp: true  },
  76: { name: 'E5',  letter: 'E',   staffPos:  7, sharp: false },
  77: { name: 'F5',  letter: 'F',   staffPos:  8, sharp: false },
  78: { name: 'F♯5', letter: 'F#',  staffPos:  8, sharp: true  },
  79: { name: 'G5',  letter: 'G',   staffPos:  9, sharp: false },
  80: { name: 'G♯5', letter: 'G#',  staffPos:  9, sharp: true  },
  81: { name: 'A5',  letter: 'A',   staffPos: 10, sharp: false },
  82: { name: 'A♯5', letter: 'A#',  staffPos: 10, sharp: true  },
};

// ── Bass clef note map (MIDI 36–59) ───────────
// staffPos: diatonic steps above G2 (bottom bass line)
//   0 = G2 (line 1), 2 = B2, 4 = D3, 6 = F3, 8 = A3 (line 5 / top)
//   negative = below staff,  9 = B3 (above top),  10 = C4 (ledger above / middle C)
const BASS_NOTE_MAP = {
  36: { name: 'C2',  letter: 'C',   staffPos: -4, sharp: false },
  37: { name: 'C♯2', letter: 'C#',  staffPos: -4, sharp: true  },
  38: { name: 'D2',  letter: 'D',   staffPos: -3, sharp: false },
  39: { name: 'D♯2', letter: 'D#',  staffPos: -3, sharp: true  },
  40: { name: 'E2',  letter: 'E',   staffPos: -2, sharp: false },
  41: { name: 'F2',  letter: 'F',   staffPos: -1, sharp: false },
  42: { name: 'F♯2', letter: 'F#',  staffPos: -1, sharp: true  },
  43: { name: 'G2',  letter: 'G',   staffPos:  0, sharp: false },
  44: { name: 'G♯2', letter: 'G#',  staffPos:  0, sharp: true  },
  45: { name: 'A2',  letter: 'A',   staffPos:  1, sharp: false },
  46: { name: 'A♯2', letter: 'A#',  staffPos:  1, sharp: true  },
  47: { name: 'B2',  letter: 'B',   staffPos:  2, sharp: false },
  48: { name: 'C3',  letter: 'C',   staffPos:  3, sharp: false },
  49: { name: 'C♯3', letter: 'C#',  staffPos:  3, sharp: true  },
  50: { name: 'D3',  letter: 'D',   staffPos:  4, sharp: false },
  51: { name: 'D♯3', letter: 'D#',  staffPos:  4, sharp: true  },
  52: { name: 'E3',  letter: 'E',   staffPos:  5, sharp: false },
  53: { name: 'F3',  letter: 'F',   staffPos:  6, sharp: false },
  54: { name: 'F♯3', letter: 'F#',  staffPos:  6, sharp: true  },
  55: { name: 'G3',  letter: 'G',   staffPos:  7, sharp: false },
  56: { name: 'G♯3', letter: 'G#',  staffPos:  7, sharp: true  },
  57: { name: 'A3',  letter: 'A',   staffPos:  8, sharp: false },
  58: { name: 'A♯3', letter: 'A#',  staffPos:  8, sharp: true  },
  59: { name: 'B3',  letter: 'B',   staffPos:  9, sharp: false },
};

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
   * Return note info for any MIDI note in either map.
   * Notes ≥ 60 → treble, notes < 60 → bass.
   */
  getNoteInfo(midiNote) {
    if (midiNote >= 60) return TREBLE_NOTE_MAP[midiNote] ?? null;
    return BASS_NOTE_MAP[midiNote] ?? null;
  }

  /** Which clef does this MIDI note belong to? */
  clefFor(midiNote) {
    return midiNote >= 60 ? 'treble' : 'bass';
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

    const info = this.getNoteInfo(midiNote);
    if (info) this._drawNote(info.staffPos, info.sharp, state);
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

  _drawTrebleClef() {
    const ctx = this.ctx;
    ctx.fillStyle    = '#aaa';
    ctx.font         = '80px Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('\u{1D11E}', this.STAFF_LEFT - 4, this._staffY(0) + 12);
  }

  _drawBassClef() {
    const ctx = this.ctx;
    ctx.fillStyle    = '#aaa';
    ctx.font         = '44px Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'alphabetic';
    // Anchor so the glyph's F-line marker aligns with staffPos 6 (F3 = 4th line)
    ctx.fillText('\u{1D122}', this.STAFF_LEFT + 4, this._staffY(6) + 4);
  }

  _drawNote(staffPos, sharp, state) {
    const ctx    = this.ctx;
    const y      = this._staffY(staffPos);
    const stemUp = staffPos < 4;

    const color = state === 'correct' ? '#00ff88'
                : state === 'wrong'   ? '#ff4444'
                :                       '#e0e0e0';

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
