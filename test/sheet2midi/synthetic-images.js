// ─────────────────────────────────────────────
// Synthetic sheet music image generator for
// end-to-end OMR pipeline testing
// ─────────────────────────────────────────────
import { drawHorizontalLines, drawRect, drawEllipse } from '../test-helper.js';

/**
 * Create a synthetic binary image of a C major scale (C4–C5) on a treble staff.
 * Returns a binary image (0=black, 255=white) with known note positions.
 *
 * Layout:
 * - Image: 400×120 pixels
 * - Staff space: 10px
 * - 5 staff lines at y=30,40,50,60,70
 * - Notes: C4(y=80), D4(y=75), E4(y=70), F4(y=65), G4(y=60), A4(y=55), B4(y=50), C5(y=45)
 * - Each note is a filled ellipse (rx=5, ry=4) with a stem
 *
 * @returns {{binary: Uint8Array, width: number, height: number, staffSpace: number, expectedNotes: Array}}
 */
export function createCScaleImage() {
  const width = 400;
  const height = 120;
  const binary = new Uint8Array(width * height).fill(255);
  const staffSpace = 10;
  const halfSpace = staffSpace / 2;

  // Draw 5 staff lines
  const staffLines = [30, 40, 50, 60, 70];
  drawHorizontalLines(binary, width, height, staffLines, 2);

  // Note positions: C4 is 1 ledger line below (y=80), up to C5 (y=45)
  // staffPos: C4=-2, D4=-1, E4=0, F4=1, G4=2, A4=3, B4=4, C5=5
  const noteData = [
    { name: 'C', octave: 4, midi: 60, staffPos: -2, x: 60 },
    { name: 'D', octave: 4, midi: 62, staffPos: -1, x: 100 },
    { name: 'E', octave: 4, midi: 64, staffPos: 0,  x: 140 },
    { name: 'F', octave: 4, midi: 65, staffPos: 1,  x: 180 },
    { name: 'G', octave: 4, midi: 67, staffPos: 2,  x: 220 },
    { name: 'A', octave: 4, midi: 69, staffPos: 3,  x: 260 },
    { name: 'B', octave: 4, midi: 71, staffPos: 4,  x: 300 },
    { name: 'C', octave: 5, midi: 72, staffPos: 5,  x: 340 },
  ];

  const bottomLine = staffLines[4]; // y=70

  for (const note of noteData) {
    const noteY = bottomLine - note.staffPos * halfSpace;

    // Draw filled notehead (ellipse)
    drawEllipse(binary, width, note.x, Math.round(noteY), 5, 4, 0);

    // Draw stem (vertical line to the right of notehead, going up)
    const stemX = note.x + 5;
    const stemTop = Math.round(noteY) - 25;
    const stemBottom = Math.round(noteY) - 1;
    drawRect(binary, width, stemX, stemTop, 2, stemBottom - stemTop, 0);

    // Draw ledger line for C4 (below staff)
    if (note.staffPos === -2) {
      const ledgerY = Math.round(noteY);
      for (let x = note.x - 8; x <= note.x + 8; x++) {
        if (x >= 0 && x < width) binary[ledgerY * width + x] = 0;
      }
    }
  }

  return {
    binary,
    width,
    height,
    staffSpace,
    staffLines,
    expectedNotes: noteData
  };
}

/**
 * Create a simple image with 4 quarter notes and a quarter rest.
 * @returns {{binary: Uint8Array, width: number, height: number, staffSpace: number, expectedNotes: Array, expectedRests: Array}}
 */
export function createNotesWithRestImage() {
  const width = 300;
  const height = 100;
  const binary = new Uint8Array(width * height).fill(255);
  const staffSpace = 10;
  const halfSpace = staffSpace / 2;

  // Draw 5 staff lines
  const staffLines = [20, 30, 40, 50, 60];
  drawHorizontalLines(binary, width, height, staffLines, 2);

  const bottomLine = staffLines[4]; // y=60

  // 3 quarter notes, then a rest area, then 1 quarter note
  const notes = [
    { name: 'E', midi: 64, staffPos: 0, x: 50 },
    { name: 'F', midi: 65, staffPos: 1, x: 100 },
    { name: 'G', midi: 67, staffPos: 2, x: 150 },
    // rest at x≈200
    { name: 'E', midi: 64, staffPos: 0, x: 250 },
  ];

  for (const note of notes) {
    const noteY = bottomLine - note.staffPos * halfSpace;
    drawEllipse(binary, width, note.x, Math.round(noteY), 5, 4, 0);
    const stemX = note.x + 5;
    drawRect(binary, width, stemX, Math.round(noteY) - 25, 2, 24, 0);
  }

  return {
    binary,
    width,
    height,
    staffSpace,
    staffLines,
    expectedNotes: notes
  };
}
