// ─────────────────────────────────────────────
// flashcard-main.js — wiring for flashcard.html
// ─────────────────────────────────────────────

import { EventBus }         from './core/EventBus.js';
import { MIDIInput }        from './input/MIDIInput.js';
import { FlashcardGame }    from './flashcard/FlashcardGame.js';
import { Synth }            from './audio/Synth.js';

// ── Bootstrap ──
const bus        = new EventBus();
const midiInput  = new MIDIInput(bus);

// ── DOM refs ──
const canvas       = document.getElementById('staff-canvas');
const scoreEl      = document.getElementById('score');
const streakEl     = document.getElementById('streak');
const feedbackEl   = document.getElementById('feedback');
const nextBtn      = document.getElementById('btn-next');
const midiStatus   = document.getElementById('midi-status');
const noteButtons  = document.querySelectorAll('.note-btn');
const deviceSelect = document.getElementById('midi-device-select');
const reprSelect   = document.getElementById('repr-select');

// ── Game ──
const synth = new Synth();
const game = new FlashcardGame(canvas, bus, { scoreEl, streakEl, feedbackEl, nextBtn }, synth);

const playNoteBtn = document.getElementById('btn-play-note');

nextBtn.addEventListener('click', () => game.nextNote());
playNoteBtn.addEventListener('click', () => game.playCurrentNote());
reprSelect.addEventListener('change', () => game.setMode(reprSelect.value));

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

// ── Back button cleanup ──
const backLink = document.querySelector('.back-link');
backLink.addEventListener('click', (e) => {
  e.preventDefault();
  game.destroy();
  window.location.href = backLink.href;
});

// ── Start ──
midiInput.init();
game.start();
