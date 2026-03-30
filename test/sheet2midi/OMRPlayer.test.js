// ─────────────────────────────────────────────
// OMRPlayer.test.js — unit tests for the
// in-browser MIDI playback synthesizer
// ─────────────────────────────────────────────
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OMRPlayer } from '../../src/sheet2midi/OMRPlayer.js';

// ── Minimal Web Audio mocks ────────────────────

class MockOscillator {
  constructor() {
    this.type = 'sine';
    this.frequency = { value: 0 };
    this._started = false;
    this._stopped = false;
    this._connected = null;
  }
  connect(node) { this._connected = node; return node; }
  start(t) { this._started = true; this._startTime = t; }
  stop(t) { this._stopped = true; this._stopTime = t; }
}

class MockGain {
  constructor() {
    this.gain = { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} };
    this._connected = null;
  }
  connect(node) { this._connected = node; return node; }
  disconnect() { this._disconnected = true; }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this._oscillators = [];
    this._gains = [];
    this.state = 'running';
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

// ── Tests ──────────────────────────────────────

describe('OMRPlayer: midiToFreq', () => {
  it('A4 (midi 69) = 440 Hz', () => {
    const f = OMRPlayer.midiToFreq(69);
    assert.ok(Math.abs(f - 440) < 0.01, `Expected ~440 Hz, got ${f}`);
  });

  it('C4 (midi 60) ≈ 261.63 Hz', () => {
    const f = OMRPlayer.midiToFreq(60);
    assert.ok(Math.abs(f - 261.626) < 0.01, `Expected ~261.63 Hz, got ${f}`);
  });

  it('A5 (midi 81) = 880 Hz', () => {
    const f = OMRPlayer.midiToFreq(81);
    assert.ok(Math.abs(f - 880) < 0.01, `Expected ~880 Hz, got ${f}`);
  });

  it('C5 (midi 72) ≈ 523.25 Hz', () => {
    const f = OMRPlayer.midiToFreq(72);
    assert.ok(Math.abs(f - 523.251) < 0.01, `Expected ~523.25 Hz, got ${f}`);
  });
});

describe('OMRPlayer: lifecycle', () => {
  let player;
  let ctx;

  beforeEach(() => {
    ctx = new MockAudioContext();
    player = new OMRPlayer(ctx);
  });

  it('isPlaying is false initially', () => {
    assert.equal(player.isPlaying, false);
  });

  it('play() sets isPlaying = true', () => {
    const notes = [{ midiNote: 60, beats: 1 }];
    player.play(notes, 120);
    assert.equal(player.isPlaying, true);
  });

  it('stop() sets isPlaying = false', () => {
    const notes = [{ midiNote: 60, beats: 1 }];
    player.play(notes, 120);
    player.stop();
    assert.equal(player.isPlaying, false);
  });

  it('play() with empty notes does not throw', () => {
    assert.doesNotThrow(() => player.play([], 120));
  });

  it('play() schedules one oscillator per note', () => {
    const notes = [
      { midiNote: 60, beats: 1 },
      { midiNote: 64, beats: 1 },
      { midiNote: 67, beats: 1 }
    ];
    player.play(notes, 120);
    assert.equal(ctx._oscillators.length, 3);
  });

  it('play() sets correct frequencies on oscillators', () => {
    const notes = [
      { midiNote: 69, beats: 1 }, // A4 = 440 Hz
      { midiNote: 60, beats: 1 }  // C4 ≈ 261.63 Hz
    ];
    player.play(notes, 120);
    assert.ok(Math.abs(ctx._oscillators[0].frequency.value - 440) < 0.01);
    assert.ok(Math.abs(ctx._oscillators[1].frequency.value - 261.626) < 0.01);
  });

  it('stop() disconnects all gain nodes', () => {
    const notes = [{ midiNote: 60, beats: 1 }, { midiNote: 64, beats: 1 }];
    player.play(notes, 120);
    player.stop();
    for (const g of ctx._gains) {
      assert.ok(g._disconnected, 'Gain node not disconnected');
    }
  });

  it('play() with faster BPM produces shorter note duration', () => {
    const notes = [{ midiNote: 60, beats: 1 }];
    // At 120 BPM: beat duration = 0.5s
    // At 240 BPM: beat duration = 0.25s
    player.play(notes, 120);
    const osc120 = ctx._oscillators[0];
    player.stop();

    const ctx2 = new MockAudioContext();
    const player2 = new OMRPlayer(ctx2);
    player2.play(notes, 240);
    const osc240 = ctx2._oscillators[0];

    const dur120 = osc120._stopTime - osc120._startTime;
    const dur240 = osc240._stopTime - osc240._startTime;
    assert.ok(dur120 > dur240, `120BPM (${dur120}s) should be longer than 240BPM (${dur240}s)`);
  });
});
