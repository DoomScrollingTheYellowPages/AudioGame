// ─────────────────────────────────────────────
// speed-reader-main.js — wiring for speed-reader.html
// ─────────────────────────────────────────────

import { EventBus }         from './core/EventBus.js';
import { MIDIInput }        from './input/MIDIInput.js';
import { AudioInput }       from './input/AudioInput.js';
import { createPitchBridge, detectPitch, freqToNote } from './core/PitchDetector.js';
import { SpeedReaderGame }  from './flashcard/SpeedReaderGame.js';
import { Synth }            from './audio/Synth.js';

// ── Bootstrap ──
const bus       = new EventBus();
const midiInput = new MIDIInput(bus);
const audioInput = new AudioInput(bus);

// ── DOM refs ──
const canvas       = document.getElementById('staff-canvas');
const npmEl        = document.getElementById('npm');
const notesEl      = document.getElementById('notes-count');
const accuracyEl   = document.getElementById('accuracy');
const timerEl      = document.getElementById('timer');
const feedbackEl   = document.getElementById('feedback');
const streakEl     = document.getElementById('streak-display');
const midiStatus   = document.getElementById('midi-status');
const audioStatus  = document.getElementById('audio-status');
const micBtn       = document.getElementById('btn-mic');
const detectedEl   = document.getElementById('detected-pitch');
const noteButtons  = document.querySelectorAll('.note-btn');
const deviceSelect = document.getElementById('midi-device-select');

// ── Game ──
const synth = new Synth();
const game = new SpeedReaderGame(canvas, bus, {
  npmEl, notesEl, accuracyEl, timerEl, feedbackEl, streakEl,
}, synth);

noteButtons.forEach(btn => {
  btn.addEventListener('click', () => game.submitAnswer(btn.dataset.note));
});

// Keyboard input: a=C s=D d=E f=F g=G h=A j=B
const KEY_MAP = { a: 'C', s: 'D', d: 'E', f: 'F', g: 'G', h: 'A', j: 'B' };
document.addEventListener('keydown', (e) => {
  const note = KEY_MAP[e.key.toLowerCase()];
  if (note) game.submitAnswer(note);
});

// ── Back button cleanup ──
const backLink = document.querySelector('.back-link');
backLink.addEventListener('click', (e) => {
  e.preventDefault();
  game.destroy();
  synth.hardStop();
  audioInput.stop();
  window.location.href = backLink.href;
});

// ── MIDI status ──
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

bus.on('midi:devices', ({ inputs }) => {
  deviceSelect.innerHTML = inputs.length
    ? inputs.map(d => `<option value="${d.id}">${d.name}</option>`).join('')
    : '<option>\u2014 no devices \u2014</option>';
});

deviceSelect.addEventListener('change', () => midiInput.connect(deviceSelect.value));

bus.on('midi:noteOn', () => {
  midiStatus.textContent   = 'MIDI connected';
  midiStatus.dataset.state = 'ok';
});

// ── Audio / Mic ──
let micActive  = false;
let pitchUnsub = null;

micBtn.addEventListener('click', async () => {
  if (!micActive) await audioInput.start();
  else audioInput.stop();
});

bus.on('audio:state', ({ active, error }) => {
  micActive = active;
  micBtn.dataset.active = String(active);
  if (active) {
    audioStatus.textContent   = 'Listening';
    audioStatus.dataset.state = 'ok';
    if (!pitchUnsub) {
      pitchUnsub = createPitchBridge(bus, { centsThreshold: 25, stabilityCount: 3 });
    }
  } else {
    audioStatus.textContent    = error ? 'Mic error' : '';
    audioStatus.dataset.state  = error ? 'err' : '';
    detectedEl.textContent     = '';
    detectedEl.dataset.hearing = 'false';
    if (pitchUnsub) { pitchUnsub(); pitchUnsub = null; }
  }
});

bus.on('audio:frame', ({ timeDomain, sampleRate }) => {
  if (!micActive) return;
  const freq = detectPitch(timeDomain, sampleRate);
  if (freq) {
    const { noteName, octave, cents } = freqToNote(freq);
    const sign = cents >= 0 ? '+' : '';
    detectedEl.textContent     = `hearing: ${noteName}${octave}  (${sign}${cents}\u00A2)`;
    detectedEl.dataset.hearing = 'true';
  } else {
    detectedEl.textContent     = 'hearing: \u2014';
    detectedEl.dataset.hearing = 'false';
  }
});

// ── Start ──
midiInput.init();
game.start();
