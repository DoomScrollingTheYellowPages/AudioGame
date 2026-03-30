// ─────────────────────────────────────────────
// speed-reader-main.js — wiring for speed-reader.html
// ─────────────────────────────────────────────

import { EventBus }        from './core/EventBus.js';
import { MIDIInput }       from './input/MIDIInput.js';
import { SpeedReaderGame } from './flashcard/SpeedReaderGame.js';
import { Synth }           from './audio/Synth.js';

// ── Bootstrap ──
const bus       = new EventBus();
const midiInput = new MIDIInput(bus);

// ── DOM refs ──
const canvas     = document.getElementById('staff-canvas');
const npmEl      = document.getElementById('npm');
const notesEl    = document.getElementById('notes-count');
const accuracyEl = document.getElementById('accuracy');
const timerEl    = document.getElementById('timer');
const feedbackEl = document.getElementById('feedback');
const streakEl   = document.getElementById('streak-display');
const midiStatus = document.getElementById('midi-status');
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

// ── Clef select ──
const clefSelect = document.getElementById('clef-select');
clefSelect.addEventListener('change', () => game.setClefMode(clefSelect.value));

// ── Representation select ──
const reprSelect = document.getElementById('repr-select');
reprSelect.addEventListener('change', () => game.setMode(reprSelect.value));

// Piano layout: white keys on home row, black keys on top row
const KEY_MAP = {
  a: 'C', w: 'C#', s: 'D', e: 'D#', d: 'E',
  f: 'F', t: 'F#', g: 'G', y: 'G#', h: 'A', u: 'A#', j: 'B',
};
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

// ── Start ──
midiInput.init();
game.start();
