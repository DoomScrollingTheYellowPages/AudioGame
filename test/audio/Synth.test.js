// ─────────────────────────────────────────────
// Synth.test.js — unit tests
// Tests the non-Web-Audio portions of Synth
// and the midiToFreq helper via a mock AudioContext.
// ─────────────────────────────────────────────
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Synth } from '../../src/audio/Synth.js';

// ── Minimal Web Audio mock ────────────────────
// Synth uses: AudioContext, createOscillator, createGain, destination
// We only need enough to satisfy the constructor + noteOn/noteOff paths.

class MockGain {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      cancelScheduledValues() {},
    };
    this._connected = [];
  }
  connect(dest) { this._connected.push(dest); }
}

class MockOscillator {
  constructor() {
    this.type = 'sine';
    this.frequency = { value: 440 };
    this._started = false;
    this._stopped = false;
  }
  connect() {}
  start() { this._started = true; }
  stop() { this._stopped = true; }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this.state = 'running';
    this._oscillators = [];
    this._gains = [];
  }
  createOscillator() {
    const osc = new MockOscillator();
    this._oscillators.push(osc);
    return osc;
  }
  createGain() {
    const g = new MockGain();
    this._gains.push(g);
    return g;
  }
  close() { this.state = 'closed'; }
}

// ── Install mock into globalThis ──────────────
// Synth uses `window.AudioContext || window.webkitAudioContext`
// In Node.js, `window` doesn't exist — expose it as an alias for globalThis.

let _origWindow;

before(() => {
  _origWindow = globalThis.window;
  globalThis.window = { AudioContext: MockAudioContext };
});

after(() => {
  if (_origWindow !== undefined) {
    globalThis.window = _origWindow;
  } else {
    delete globalThis.window;
  }
});

// ── Tests ──────────────────────────────────────

describe('Synth', () => {

  describe('midiToFreq (via noteOn frequency assignment)', () => {
    it('A4 (MIDI 69) → 440 Hz', () => {
      const synth = new Synth();
      synth.noteOn(69, 80);
      const ctx = synth._ctx;
      // First oscillator created should be tuned to freq of MIDI 69
      const osc = ctx._oscillators[0];
      assert.ok(Math.abs(osc.frequency.value - 440) < 0.01,
        `Expected 440Hz, got ${osc.frequency.value}`);
      synth.destroy();
    });

    it('C4 (MIDI 60) → ≈261.63 Hz', () => {
      const synth = new Synth();
      synth.noteOn(60, 80);
      const ctx = synth._ctx;
      const osc = ctx._oscillators[0];
      assert.ok(Math.abs(osc.frequency.value - 261.626) < 0.01,
        `Expected ~261.63Hz, got ${osc.frequency.value}`);
      synth.destroy();
    });

    it('one octave up doubles frequency', () => {
      const synth = new Synth();
      synth.noteOn(69, 80);
      const freqA4 = synth._ctx._oscillators[0].frequency.value;
      synth.destroy();

      const synth2 = new Synth();
      synth2.noteOn(81, 80); // A5
      const freqA5 = synth2._ctx._oscillators[0].frequency.value;
      assert.ok(Math.abs(freqA5 - freqA4 * 2) < 0.5,
        `A5 (${freqA5}) should be 2× A4 (${freqA4})`);
      synth2.destroy();
    });
  });

  describe('noteOff safety', () => {
    it('noteOff on a note that was never started does not throw', () => {
      const synth = new Synth();
      synth.noteOn(60, 80); // init AudioContext
      assert.doesNotThrow(() => synth.noteOff(99)); // MIDI 99 never started
      synth.destroy();
    });

    it('noteOff twice on the same note does not throw', () => {
      const synth = new Synth();
      synth.noteOn(60, 80);
      synth.noteOff(60);
      assert.doesNotThrow(() => synth.noteOff(60)); // second call
      synth.destroy();
    });
  });

  describe('allNotesOff', () => {
    it('calling allNotesOff on an empty Synth does not throw', () => {
      const synth = new Synth();
      assert.doesNotThrow(() => synth.allNotesOff());
      synth.destroy();
    });

    it('allNotesOff clears all voices', () => {
      const synth = new Synth();
      synth.noteOn(60, 80);
      synth.noteOn(64, 80);
      synth.allNotesOff();
      assert.equal(synth._voices.size, 0);
      synth.destroy();
    });
  });

  describe('hardStop', () => {
    it('hardStop on uninitialized Synth does not throw', () => {
      const synth = new Synth();
      assert.doesNotThrow(() => synth.hardStop());
    });

    it('hardStop clears voices immediately', () => {
      const synth = new Synth();
      synth.noteOn(60, 80);
      synth.noteOn(62, 80);
      synth.hardStop();
      assert.equal(synth._voices.size, 0);
      synth.destroy();
    });
  });

  describe('volume controls', () => {
    it('setMasterVolume updates gain value after context init', () => {
      const synth = new Synth();
      synth.noteOn(60, 80); // init context
      synth.setMasterVolume(0.3);
      assert.equal(synth._masterVolume, 0.3);
      assert.equal(synth._masterGain.gain.value, 0.3);
      synth.destroy();
    });

    it('setMetronomeVolume updates metronome gain', () => {
      const synth = new Synth();
      synth.noteOn(60, 80); // init context
      synth.setMetronomeVolume(0.7);
      assert.equal(synth._metronomeVolume, 0.7);
      assert.equal(synth._metronomeGain.gain.value, 0.7);
      synth.destroy();
    });
  });

  describe('destroy', () => {
    it('destroy closes the AudioContext', () => {
      const synth = new Synth();
      synth.noteOn(60, 80); // init context
      const ctx = synth._ctx;
      synth.destroy();
      assert.equal(ctx.state, 'closed');
      assert.equal(synth._ctx, null);
    });

    it('destroy on uninitialized Synth does not throw', () => {
      const synth = new Synth();
      assert.doesNotThrow(() => synth.destroy());
    });
  });
});
