// ─────────────────────────────────────────────
// flashcard-main.js — wiring for flashcard.html
// ─────────────────────────────────────────────

import { EventBus }         from './core/EventBus.js';
import { MIDIInput }        from './input/MIDIInput.js';
import { AudioInput }       from './input/AudioInput.js';
import { createPitchBridge, detectPitch, freqToNote } from './core/PitchDetector.js';
import { FlashcardGame }    from './flashcard/FlashcardGame.js';

// ── Bootstrap ──
const bus        = new EventBus();
const midiInput  = new MIDIInput(bus);
const audioInput = new AudioInput(bus);

// ── DOM refs ──
const canvas       = document.getElementById('staff-canvas');
const scoreEl      = document.getElementById('score');
const streakEl     = document.getElementById('streak');
const feedbackEl   = document.getElementById('feedback');
const nextBtn      = document.getElementById('btn-next');
const midiStatus   = document.getElementById('midi-status');
const audioStatus  = document.getElementById('audio-status');
const micBtn       = document.getElementById('btn-mic');
const detectedEl   = document.getElementById('detected-pitch');
const noteButtons  = document.querySelectorAll('.note-btn');

// ── Game ──
const game = new FlashcardGame(canvas, bus, { scoreEl, streakEl, feedbackEl, nextBtn });

nextBtn.addEventListener('click', () => game.nextNote());

noteButtons.forEach(btn => {
  btn.addEventListener('click', () => game.submitAnswer(btn.dataset.note));
});

// ── MIDI status display ──
bus.on('midi:state', ({ supported, access }) => {
  if (!supported) {
    midiStatus.textContent   = 'MIDI n/a';
    midiStatus.dataset.state = 'err';
  } else if (!access) {
    midiStatus.textContent   = 'MIDI denied';
    midiStatus.dataset.state = 'err';
  } else {
    midiStatus.textContent   = 'MIDI ready';
    midiStatus.dataset.state = 'ok';
  }
});

bus.on('midi:noteOn', () => {
  midiStatus.textContent   = 'MIDI connected';
  midiStatus.dataset.state = 'ok';
});

// ── Audio / Mic ──

let micActive   = false;
let pitchUnsub  = null;

micBtn.addEventListener('click', async () => {
  if (!micActive) {
    await audioInput.start();
  } else {
    audioInput.stop();
  }
});

bus.on('audio:state', ({ active, error }) => {
  micActive = active;
  micBtn.dataset.active = String(active);

  if (active) {
    audioStatus.textContent   = 'Listening';
    audioStatus.dataset.state = 'ok';

    // Start the pitch bridge when mic goes active
    if (!pitchUnsub) {
      pitchUnsub = createPitchBridge(bus, {
        centsThreshold: 25,
        stabilityCount: 3,
      });
    }
  } else {
    audioStatus.textContent   = error ? `Mic error` : '';
    audioStatus.dataset.state = error ? 'err' : '';
    detectedEl.textContent    = '';
    detectedEl.dataset.hearing = 'false';

    // Tear down pitch bridge
    if (pitchUnsub) {
      pitchUnsub();
      pitchUnsub = null;
    }
  }
});

// Show detected pitch in real-time (separate from the bridge that triggers answers)
bus.on('audio:frame', ({ timeDomain, sampleRate }) => {
  if (!micActive) return;

  const freq = detectPitch(timeDomain, sampleRate);
  if (freq) {
    const { noteName, octave, cents } = freqToNote(freq);
    const sign = cents >= 0 ? '+' : '';
    detectedEl.textContent     = `hearing: ${noteName}${octave}  (${sign}${cents}¢)`;
    detectedEl.dataset.hearing = 'true';
  } else {
    detectedEl.textContent     = 'hearing: —';
    detectedEl.dataset.hearing = 'false';
  }
});

// ── Start ──
midiInput.init();
game.start();
