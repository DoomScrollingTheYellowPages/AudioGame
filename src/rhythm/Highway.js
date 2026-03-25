// ─────────────────────────────────────────────
// Highway — horizontal scrolling note renderer
// ─────────────────────────────────────────────
// Draws a piano-roll style highway on a canvas.
// Notes scroll right-to-left toward a hit zone
// on the left edge. All 12 chromatic notes get a lane.
// ─────────────────────────────────────────────

import { Theme } from '../core/Theme.js';

// All 12 pitch classes in chromatic order
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LANE_COUNT  = 12;

// true = black key (visually darker lane)
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];

// Map note name → lane index (C=0 at bottom, B=11 at top)
const LANE_MAP = {};
NOTE_NAMES.forEach((name, i) => { LANE_MAP[name] = i; });

const HIT_ZONE_X    = 80;        // pixels from left edge
const LOOK_AHEAD    = 3000;      // ms of notes visible ahead
const PIXELS_PER_MS = 0.25;      // scroll speed (canvas pixels per ms)

function getColors() {
  const t = Theme.current();
  return {
    bg: t.bg,
    laneWhite: t.laneBg,
    laneBlack: t.laneBgAlt,
    laneLine: t.laneLine,
    hitZone: t.hitZone,
    hitZoneActive: t.hitZoneActive,
    note: t.note,
    noteActive: t.noteActive,
    perfect: t.perfect,
    great: t.great,
    good: t.good,
    miss: t.miss,
    labelBlack: t.dimText,
    labelActive: t.accent,
    beatLine: t.beatLine,
    barLine: t.barLine,
  };
}

export class Highway {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(canvas, bus) {
    this._canvas      = canvas;
    this._ctx         = canvas.getContext('2d');
    this._bus         = bus;
    this._noteStates  = new Map(); // noteIndex → tier | 'miss'
    this._activeLanes = new Set(); // currently pressed note names

    this._bpm    = 120;
    this._meter  = [4, 4];
    this._countIn = 2000;

    bus.on('hit:judge', ({ noteIndex, tier }) => this._noteStates.set(noteIndex, tier));
    bus.on('hit:miss',  ({ noteIndex })        => this._noteStates.set(noteIndex, 'miss'));
  }

  /** Store song timing info for drawing beat/bar lines. */
  setSongInfo(bpm, meter, countIn) {
    this._bpm    = bpm;
    this._meter  = meter || [4, 4];
    this._countIn = countIn || 2000;
  }

  /** Mark a lane as actively pressed (for hit zone glow). */
  setLaneActive(noteName, active) {
    if (active) this._activeLanes.add(noteName);
    else        this._activeLanes.delete(noteName);
  }

  /**
   * Draw one frame.
   * @param {number} position  — current song time in ms
   * @param {Array}  notes     — full note array from SongEngine
   */
  draw(position, notes) {
    const COLORS = getColors();
    const ctx  = this._ctx;
    const W    = this._canvas.width;
    const H    = this._canvas.height;
    const laneH = H / LANE_COUNT;

    // ── Background ──
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Lane backgrounds + dividers (C at bottom → B at top) ──
    for (let i = 0; i < LANE_COUNT; i++) {
      const row = LANE_COUNT - 1 - i;   // lane 0 (C) → bottom row
      const y   = row * laneH;
      ctx.fillStyle = IS_BLACK[i] ? COLORS.laneBlack : COLORS.laneWhite;
      ctx.fillRect(HIT_ZONE_X, y, W - HIT_ZONE_X, laneH);

      ctx.strokeStyle = COLORS.laneLine;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(HIT_ZONE_X, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // ── Lane labels (left side) ──
    ctx.font          = 'bold 11px "Courier New", monospace';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    for (let i = 0; i < LANE_COUNT; i++) {
      const name  = NOTE_NAMES[i];
      const row   = LANE_COUNT - 1 - i;
      const isAct = this._activeLanes.has(name);
      ctx.fillStyle = isAct
        ? COLORS.labelActive
        : (IS_BLACK[i] ? COLORS.labelBlack : COLORS.barLine);
      ctx.fillText(name, HIT_ZONE_X / 2, row * laneH + laneH / 2);
    }

    // ── Beat / bar lines ──
    this._drawBeatLines(ctx, position, W, H);

    // ── Hit zone line ──
    ctx.strokeStyle = this._activeLanes.size > 0 ? COLORS.hitZoneActive : COLORS.hitZone;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(HIT_ZONE_X, 0);
    ctx.lineTo(HIT_ZONE_X, H);
    ctx.stroke();

    // ── Notes ──
    const pad = 2;
    for (let i = 0; i < notes.length; i++) {
      const n    = notes[i];
      const name = NOTE_NAMES[n.note % 12];
      const lane = LANE_MAP[name];
      if (lane === undefined) continue;

      const dx = n.time - position;
      if (dx > LOOK_AHEAD || dx + n.duration / (1 / PIXELS_PER_MS) < -500) continue;

      const x   = HIT_ZONE_X + dx * PIXELS_PER_MS;
      const w   = Math.max(n.duration * PIXELS_PER_MS, 8);
      const row = LANE_COUNT - 1 - lane;   // invert: C at bottom
      const y   = row * laneH + pad;
      const h   = laneH - pad * 2;

      const state = this._noteStates.get(i);
      if      (state === 'Perfect') ctx.fillStyle = COLORS.perfect;
      else if (state === 'Great')   ctx.fillStyle = COLORS.great;
      else if (state === 'Good')    ctx.fillStyle = COLORS.good;
      else if (state === 'miss')    ctx.fillStyle = COLORS.miss;
      else ctx.fillStyle = dx <= 0 ? COLORS.note : COLORS.noteActive;

      // Rounded rect
      const r = 3;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
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

  // ── Beat / bar line rendering ──────────────────
  _drawBeatLines(ctx, position, W, H) {
    const COLORS = getColors();
    const msPerBeat  = 60000 / this._bpm;
    const beatsPerBar = this._meter[0];

    const minTime  = position - 200;
    const maxTime  = position + LOOK_AHEAD;
    const firstBeat = Math.max(0, Math.floor(minTime / msPerBeat));
    const lastBeat  = Math.ceil(maxTime / msPerBeat);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = '9px "Courier New", monospace';

    for (let b = firstBeat; b <= lastBeat; b++) {
      const beatTime  = b * msPerBeat;
      const dx        = beatTime - position;
      const x         = HIT_ZONE_X + dx * PIXELS_PER_MS;
      if (x < HIT_ZONE_X || x > W) continue;

      const beatInBar = b % beatsPerBar;
      const isBarLine = beatInBar === 0;

      ctx.strokeStyle = isBarLine ? COLORS.barLine  : COLORS.beatLine;
      ctx.lineWidth   = isBarLine ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      if (isBarLine) {
        const bar = Math.floor(b / beatsPerBar);
        const countInBeats  = Math.ceil(this._countIn / msPerBeat);
        const displayBar    = bar - Math.floor(countInBeats / beatsPerBar) + 1;
        if (displayBar >= 1) {
          ctx.fillStyle = COLORS.barLine;
          ctx.fillText(`${displayBar}`, x, 3);
        }
      }
    }
  }
}
