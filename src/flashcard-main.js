// ─────────────────────────────────────────────
// flashcard-main.js — wiring for flashcard.html
// ─────────────────────────────────────────────

import { EventBus }      from './core/EventBus.js';
import { MIDIInput }     from './input/MIDIInput.js';
import { FlashcardGame } from './flashcard/FlashcardGame.js';

// ── Bootstrap ──
const bus       = new EventBus();
const midiInput = new MIDIInput(bus);

// ── DOM refs ──
const canvas     = document.getElementById('staff-canvas');
const scoreEl    = document.getElementById('score');
const streakEl   = document.getElementById('streak');
const feedbackEl = document.getElementById('feedback');
const nextBtn    = document.getElementById('btn-next');
const midiStatus = document.getElementById('midi-status');
const noteButtons = document.querySelectorAll('.note-btn');

// ── Game ──
const game = new FlashcardGame(canvas, bus, { scoreEl, streakEl, feedbackEl, nextBtn });

nextBtn.addEventListener('click', () => game.nextNote());

noteButtons.forEach(btn => {
  btn.addEventListener('click', () => game.submitAnswer(btn.dataset.note));
});

// ── MIDI status display ──
bus.on('midi:state', ({ supported, access }) => {
  if (!supported) {
    midiStatus.textContent  = 'MIDI not supported';
    midiStatus.dataset.state = 'err';
  } else if (!access) {
    midiStatus.textContent   = 'MIDI access denied';
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

// ── Start ──
midiInput.init();
game.start();
