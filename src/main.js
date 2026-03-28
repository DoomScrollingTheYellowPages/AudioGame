// ─────────────────────────────────────────────
// main.js — wiring
// ─────────────────────────────────────────────
// Creates the EventBus, input modules, and UI
// modules, and connects them together. This is
// the only file that knows about all the pieces.
// ─────────────────────────────────────────────

import { EventBus }         from './core/EventBus.js';
import { Theme }            from './core/Theme.js';
import { AudioInput }       from './input/AudioInput.js';
import { MIDIInput }        from './input/MIDIInput.js';
import { Oscilloscope }     from './ui/Oscilloscope.js';
import { Tuner }           from './ui/Tuner.js';
import { KeyboardDisplay }  from './ui/KeyboardDisplay.js';
import { CCDisplay }        from './ui/CCDisplay.js';
import { MIDILog }          from './ui/MIDILog.js';

// ── Bootstrap ──
const bus = new EventBus();

// ── Inputs ──
const audioInput = new AudioInput(bus);
const midiInput  = new MIDIInput(bus);

// ── UI: Audio panel ──
const audioPanel = document.getElementById('audio-panel');
const btnAudio   = document.getElementById('start-audio');

const oscilloscope = new Oscilloscope(audioPanel, bus);
const tuner        = new Tuner(document.getElementById('tuner-wrap'), bus);

btnAudio.addEventListener('click', async () => {
  if (audioInput.active) return;
  await audioInput.start();
});

bus.on('audio:state', ({ active, error }) => {
  if (active) {
    btnAudio.textContent = 'Microphone Active';
    btnAudio.classList.add('active');
  } else if (error) {
    btnAudio.textContent = 'Permission denied';
    btnAudio.style.color = Theme.current().error;
  }
});

// ── UI: MIDI panel ──
const selectEl = document.getElementById('midi-device-select');
const statusEl = document.getElementById('midi-status');

const keyboard = new KeyboardDisplay(
  document.getElementById('keyboard-wrap'),
  bus,
);

const ccDisplay = new CCDisplay(
  document.getElementById('cc-grid'),
  bus,
);

const midiLog = new MIDILog(
  document.getElementById('midi-log'),
  bus,
);

// Device selector
bus.on('midi:devices', ({ inputs }) => {
  selectEl.innerHTML = inputs.length
    ? inputs.map(d => `<option value="${d.id}">${d.name}</option>`).join('')
    : '<option>\u2014 no devices \u2014</option>';
});

bus.on('midi:state', ({ supported, access, error }) => {
  if (!supported) {
    statusEl.textContent = 'not supported';
    statusEl.className   = 'midi-status err';
  } else if (!access) {
    statusEl.textContent = 'access denied';
    statusEl.className   = 'midi-status err';
  } else {
    statusEl.textContent = 'ready';
    statusEl.className   = 'midi-status ok';
  }
});

// When user picks a different device
selectEl.addEventListener('change', () => midiInput.connect(selectEl.value));

// Update status on note activity (shows "connected" once first message arrives)
bus.on('midi:noteOn', () => {
  statusEl.textContent = 'connected';
  statusEl.className   = 'midi-status ok';
});

// ── Start MIDI ──
midiInput.init();
