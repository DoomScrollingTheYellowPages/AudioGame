// ─────────────────────────────────────────────
// SongEngine — playback clock for rhythm game
// ─────────────────────────────────────────────
// Drives the game loop using performance.now().
// Does NOT produce audio — it just tracks time
// and emits events for the Highway and HitJudge.
//
// Emits via EventBus:
//   'song:tick'  { position, notes }  — every frame
//   'song:end'                        — song finished
// ─────────────────────────────────────────────

export class SongEngine {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
    this._notes = [];
    this._bpm = 120;
    this._startTime = 0;
    this._position = 0;       // ms into the song
    this._running = false;
    this._rafId = null;
    this._songDuration = 0;   // ms total
    this._countIn = 2000;     // 2 second lead-in before notes appear
  }

  /**
   * Load a song (array of note objects).
   * @param {{ bpm: number, notes: Array<{time: number, note: number, velocity: number, duration: number}> }} song
   */
  load(song) {
    this._bpm = song.bpm;
    // Shift all note times forward by countIn so player has visual lead time
    this._notes = song.notes.map(n => ({
      ...n,
      time: n.time + this._countIn,
    }));
    const last = this._notes[this._notes.length - 1];
    this._songDuration = last ? last.time + last.duration + 2000 : 0; // 2s tail
    this._position = 0;
  }

  get notes()       { return this._notes; }
  get bpm()         { return this._bpm; }
  get duration()    { return this._songDuration; }
  get position()    { return this._position; }
  get running()     { return this._running; }
  get countIn()     { return this._countIn; }

  start() {
    if (this._running) return;
    this._running = true;
    this._startTime = performance.now();
    this._tick();
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  reset() {
    this.stop();
    this._position = 0;
  }

  _tick() {
    if (!this._running) return;

    this._position = performance.now() - this._startTime;

    this._bus.emit('song:tick', {
      position: this._position,
      notes: this._notes,
    });

    if (this._position >= this._songDuration) {
      this._running = false;
      this._bus.emit('song:end', {});
      return;
    }

    this._rafId = requestAnimationFrame(() => this._tick());
  }
}
