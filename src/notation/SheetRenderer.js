// ─────────────────────────────────────────────
// SheetRenderer — build draw commands for sheet
// music notation from a MidiToNotation model,
// and render to canvas or SVG
// ─────────────────────────────────────────────

import { Theme } from '../core/Theme.js';

// ── Layout Constants ─────────────────────────

const STAFF_SPACE = 8;        // pixels between staff lines
const HALF_SPACE = STAFF_SPACE / 2;
const MARGIN_LEFT = 60;       // left margin for clef + time sig
const MARGIN_TOP = 40;        // top margin
const NOTE_SPACING = 30;      // horizontal pixels per beat
const STAFF_LINES = 5;
const STEM_LENGTH = 28;
const NOTEHEAD_RX = 5;
const NOTEHEAD_RY = 3.5;

// ── SheetRenderer ────────────────────────────

export class SheetRenderer {
  /**
   * Build an array of draw commands from a notation model.
   * Commands are plain objects that can be rendered to canvas or SVG.
   * @param {{measures: Array, clef: string, meter: number[], bpm: number}} model
   * @returns {Array<object>}
   */
  static buildDrawCommands(model) {
    const cmds = [];
    if (model.measures.length === 0) return cmds;

    const staffTopY = MARGIN_TOP;

    // Staff lines
    const totalBeats = model.measures.reduce((s, m) => s + m.events.reduce((s2, e) => s2 + e.beats, 0), 0);
    const staffWidth = MARGIN_LEFT + totalBeats * NOTE_SPACING + 40;

    for (let i = 0; i < STAFF_LINES; i++) {
      const y = staffTopY + i * STAFF_SPACE;
      cmds.push({ type: 'staffLine', x1: 10, y, x2: staffWidth, lineIndex: i });
    }

    // Clef
    cmds.push({ type: 'clef', clef: model.clef, x: 15, y: staffTopY });

    // Time signature
    cmds.push({ type: 'timeSig', meter: model.meter, x: 40, y: staffTopY });

    // Notes, rests, bar lines
    let x = MARGIN_LEFT;
    for (let m = 0; m < model.measures.length; m++) {
      const measure = model.measures[m];

      // Bar line before measure (except first)
      if (m > 0) {
        cmds.push({
          type: 'barLine',
          x,
          y1: staffTopY,
          y2: staffTopY + (STAFF_LINES - 1) * STAFF_SPACE,
          measureNum: measure.measureNum
        });
        x += 8;
      }

      for (const event of measure.events) {
        if (event.isRest) {
          cmds.push({
            type: 'rest',
            x,
            y: staffTopY + 2 * STAFF_SPACE, // center of staff
            beats: event.beats,
            durationType: event.durationType,
          });
        } else {
          const bottomLineY = staffTopY + (STAFF_LINES - 1) * STAFF_SPACE;
          const noteY = bottomLineY - event.staffPos * HALF_SPACE;

          // Notehead
          const filled = event.beats < 4;
          cmds.push({
            type: 'notehead',
            x,
            y: noteY,
            filled,
            midiNote: event.midiNote,
            noteName: event.noteName,
            octave: event.octave,
          });

          // Stem (not for whole notes)
          if (event.beats < 4) {
            const stemDir = event.staffPos >= 4 ? 'down' : 'up';
            const stemX = stemDir === 'up' ? x + NOTEHEAD_RX : x - NOTEHEAD_RX;
            const stemY1 = noteY;
            const stemY2 = stemDir === 'up' ? noteY - STEM_LENGTH : noteY + STEM_LENGTH;
            cmds.push({ type: 'stem', x: stemX, y1: stemY1, y2: stemY2 });
          }

          // Ledger lines
          if (noteY > bottomLineY + HALF_SPACE) {
            for (let ly = bottomLineY + STAFF_SPACE; ly <= noteY + 1; ly += STAFF_SPACE) {
              cmds.push({ type: 'ledgerLine', x: x - 8, x2: x + 8, y: ly });
            }
          }
          if (noteY < staffTopY - HALF_SPACE) {
            for (let ly = staffTopY - STAFF_SPACE; ly >= noteY - 1; ly -= STAFF_SPACE) {
              cmds.push({ type: 'ledgerLine', x: x - 8, x2: x + 8, y: ly });
            }
          }
        }

        x += event.beats * NOTE_SPACING;
      }
    }

    // Final bar line
    cmds.push({
      type: 'barLine',
      x,
      y1: staffTopY,
      y2: staffTopY + (STAFF_LINES - 1) * STAFF_SPACE,
      measureNum: -1, // final
    });

    return cmds;
  }

  /**
   * Render draw commands to a canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<object>} cmds
   * @param {object} [opts]
   * @param {boolean} [opts.printMode=false] — force black-on-white
   */
  static renderToCanvas(ctx, cmds, opts = {}) {
    const t = opts.printMode
      ? { bg: '#ffffff', staffLine: '#000000', notehead: '#000000', text: '#000000', dimText: '#666666' }
      : Theme.current();

    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const cmd of cmds) {
      switch (cmd.type) {
        case 'staffLine':
          ctx.strokeStyle = t.staffLine;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cmd.x1, cmd.y);
          ctx.lineTo(cmd.x2, cmd.y);
          ctx.stroke();
          break;

        case 'notehead':
          ctx.fillStyle = t.notehead;
          ctx.beginPath();
          ctx.ellipse(cmd.x, cmd.y, NOTEHEAD_RX, NOTEHEAD_RY, -0.3, 0, Math.PI * 2);
          if (cmd.filled) ctx.fill();
          else { ctx.lineWidth = 1.5; ctx.stroke(); }
          break;

        case 'stem':
          ctx.strokeStyle = t.notehead;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(cmd.x, cmd.y1);
          ctx.lineTo(cmd.x, cmd.y2);
          ctx.stroke();
          break;

        case 'barLine':
          ctx.strokeStyle = t.staffLine;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cmd.x, cmd.y1);
          ctx.lineTo(cmd.x, cmd.y2);
          ctx.stroke();
          break;

        case 'ledgerLine':
          ctx.strokeStyle = t.staffLine;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cmd.x, cmd.y);
          ctx.lineTo(cmd.x2, cmd.y);
          ctx.stroke();
          break;

        case 'clef':
          ctx.fillStyle = t.notehead;
          ctx.font = '32px serif';
          ctx.fillText(cmd.clef === 'treble' ? '\uD834\uDD1E' : '\uD834\uDD22', cmd.x, cmd.y + 28);
          break;

        case 'timeSig':
          ctx.fillStyle = t.notehead;
          ctx.font = 'bold 14px serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(cmd.meter[0]), cmd.x, cmd.y + 14);
          ctx.fillText(String(cmd.meter[1]), cmd.x, cmd.y + 28);
          ctx.textAlign = 'start';
          break;

        case 'rest':
          ctx.fillStyle = t.dimText;
          ctx.font = '12px serif';
          ctx.textAlign = 'center';
          // Simple rest symbol placeholder
          const restSymbol = cmd.beats >= 4 ? '\u{1D13B}' : cmd.beats >= 2 ? '\u{1D13C}' : cmd.beats >= 1 ? '\u{1D13D}' : '\u{1D13E}';
          ctx.fillText(restSymbol, cmd.x, cmd.y + 4);
          ctx.textAlign = 'start';
          break;
      }
    }
  }
}
