// ─────────────────────────────────────────────
// rhythm-main.js — wiring for rhythm.html
// ─────────────────────────────────────────────

import { EventBus }       from './core/EventBus.js';
import { MIDIInput }      from './input/MIDIInput.js';
import { AudioInput }     from './input/AudioInput.js';
import { createPitchBridge, detectPitch, freqToNote } from './core/PitchDetector.js';
import { SongEngine }     from './rhythm/SongEngine.js';
import { Highway }        from './rhythm/Highway.js';
import { HitJudge }       from './rhythm/HitJudge.js';
import { listSongs, getSong } from './rhythm/DemoSongs.js';
import { MidiParser }        from './rhythm/MidiParser.js';
import { StaffHighway }      from './rhythm/StaffHighway.js';
import { Synth }             from './audio/Synth.js';

// ── Bootstrap ──
const bus          = new EventBus();
const midiInput    = new MIDIInput(bus);
const audioInput   = new AudioInput(bus);
const engine       = new SongEngine(bus);
const synth        = new Synth();
const canvas       = document.getElementById('highway-canvas');
const highway      = new Highway(canvas, bus);
const staffHighway = new StaffHighway(canvas, bus);
const judge        = new HitJudge(bus, engine);

// ── View mode ──
let viewMode = 'piano';  // 'piano' | 'staff'
function activeHighway() {
  return viewMode === 'staff' ? staffHighway : highway;
}

// ── DOM refs ──
const midiStatus   = document.getElementById('midi-status');
const audioStatus  = document.getElementById('audio-status');
const micBtn       = document.getElementById('btn-mic');
const deviceSelect = document.getElementById('midi-device-select');
const detectedEl   = document.getElementById('detected-pitch');
const songSelect   = document.getElementById('song-select');
const songBpmEl    = document.getElementById('song-bpm');
const scoreEl      = document.getElementById('score');
const comboEl      = document.getElementById('combo');
const accuracyEl   = document.getElementById('accuracy');
const progressBar  = document.getElementById('progress-bar');
const feedbackEl   = document.getElementById('hit-feedback');
const startBtn     = document.getElementById('btn-start');
const stopBtn      = document.getElementById('btn-stop');
const noteButtons  = document.querySelectorAll('.note-btn');
const resultsDiv   = document.getElementById('results');
const backdrop     = document.getElementById('backdrop');
const resultsClose = document.getElementById('results-close');
const viewBtns     = document.querySelectorAll('.view-btn');
const masterVolEl  = document.getElementById('master-vol');
const metDialEl    = document.getElementById('met-dial');
const beatIndicator = document.getElementById('beat-indicator');

// ── View toggle ──
viewBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    viewMode = btn.dataset.view;
    viewBtns.forEach(b => b.classList.toggle('active', b.dataset.view === viewMode));
    // Re-draw current frame in new mode
    activeHighway().draw(engine.position, engine.notes);
  });
});

// ── Playback controls ──
masterVolEl.addEventListener('input', () => {
  synth.setMasterVolume(masterVolEl.value / 100);
});

// Metronome rotary dial
const metDialCanvas = metDialEl.querySelector('canvas');
const metDialCtx = metDialCanvas.getContext('2d');
let metDialValue = 0.5; // 0.0–1.0

function drawMetDial(v) {
  const w = 32, h = 32, r = 12;
  const ctx = metDialCtx;
  ctx.clearRect(0, 0, w, h);

  // Track ring
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, 0.75 * Math.PI, 0.25 * Math.PI);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2a2a2a';
  ctx.stroke();

  // Value arc
  const startAngle = 0.75 * Math.PI;
  const endAngle = startAngle + v * 1.5 * Math.PI;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, startAngle, endAngle);
  ctx.lineWidth = 3;
  ctx.strokeStyle = v > 0 ? '#00ff88' : '#333';
  ctx.stroke();

  // Pointer dot
  const px = w / 2 + r * Math.cos(endAngle);
  const py = h / 2 + r * Math.sin(endAngle);
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#e0e0e0';
  ctx.fill();
}

drawMetDial(metDialValue);

// Drag interaction for dial
let dragging = false;
metDialEl.addEventListener('mousedown', (e) => {
  dragging = true;
  updateDial(e);
});
document.addEventListener('mousemove', (e) => {
  if (dragging) updateDial(e);
});
document.addEventListener('mouseup', () => { dragging = false; });

function updateDial(e) {
  const rect = metDialCanvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let angle = Math.atan2(e.clientY - cy, e.clientX - cx);
  // Map angle to 0–1: start at 0.75π (bottom-left), sweep 1.5π clockwise
  let norm = (angle - 0.75 * Math.PI) / (1.5 * Math.PI);
  // Wrap negative angles
  if (norm < -0.2) norm += (2 * Math.PI) / (1.5 * Math.PI);
  metDialValue = Math.max(0, Math.min(1, norm));
  synth.setMetronomeVolume(metDialValue);
  drawMetDial(metDialValue);
}

// ── Custom song state (set by MIDI upload) ──
let customSong = null;

// ── Song selector ──
const songs = listSongs();
songSelect.innerHTML = songs.map(s =>
  `<option value="${s.id}">${s.name}</option>`
).join('');

function loadSelectedSong() {
  const song = customSong ?? getSong(songSelect.value);
  if (!song) return;
  const noteCount = song.notes ? song.notes.length : 0;
  songBpmEl.textContent = customSong
    ? `${song.bpm} BPM (${noteCount} notes)`
    : `${song.bpm} BPM`;
  engine.load(song);
  // Pass timing info to both renderers for beat/bar lines
  highway.setSongInfo(engine.bpm, engine.meter, engine.countIn);
  staffHighway.setSongInfo(engine.bpm, engine.meter, engine.countIn);
  judge.reset();
  updateScoreUI();
}

// ── Beat indicator ──
function buildBeatPips() {
  const beatsPerBar = engine.meter[0];
  beatIndicator.innerHTML = '';
  for (let i = 0; i < beatsPerBar; i++) {
    const pip = document.createElement('div');
    pip.className = 'beat-pip';
    beatIndicator.appendChild(pip);
  }
}

function updateBeatIndicator(beatInBar, accented) {
  const pips = beatIndicator.children;
  for (let i = 0; i < pips.length; i++) {
    pips[i].classList.remove('active', 'accent', 'past');
    if (i === beatInBar) {
      pips[i].classList.add('active');
      if (accented) pips[i].classList.add('accent');
    } else if (i < beatInBar) {
      pips[i].classList.add('past');
    }
  }
}

songSelect.addEventListener('change', () => {
  clearCustomSong();
  loadSelectedSong();
  buildBeatPips();
});
loadSelectedSong();
buildBeatPips();

// ── MIDI file upload ──
const midiUpload     = document.getElementById('midi-upload');
const midiUploadName = document.getElementById('midi-upload-name');

function clearCustomSong() {
  customSong = null;
  midiUploadName.textContent = '';
  midiUpload.value = '';
}

midiUpload.addEventListener('change', async () => {
  const file = midiUpload.files[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const parsed = MidiParser.parse(buf);
    customSong = { bpm: parsed.bpm, meter: parsed.meter, notes: parsed.notes };
    midiUploadName.textContent = file.name;
    songBpmEl.textContent = `${parsed.bpm} BPM (${parsed.notes.length} notes)`;
    engine.load(customSong);
    highway.setSongInfo(engine.bpm, engine.meter, engine.countIn);
    staffHighway.setSongInfo(engine.bpm, engine.meter, engine.countIn);
    judge.reset();
    updateScoreUI();
    buildBeatPips();
    activeHighway().draw(0, engine.notes);
  } catch (err) {
    console.error('MIDI parse error:', err);
    midiUploadName.textContent = 'parse error';
    customSong = null;
  }
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

bus.on('midi:noteOn', ({ note }) => {
  midiStatus.textContent   = 'MIDI connected';
  midiStatus.dataset.state = 'ok';
  if (engine.running) {
    const name = judge.pitchName(note);
    judge.judge(name);
    activeHighway().setLaneActive(name, true);
    setTimeout(() => activeHighway().setLaneActive(name, false), 100);
  }
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
    audioStatus.textContent   = error ? 'Mic error' : '';
    audioStatus.dataset.state = error ? 'err' : '';
    detectedEl.textContent    = '';
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

// Audio pitch → judge (all 12 chromatic notes)
bus.on('audio:pitch', ({ noteName }) => {
  if (!engine.running) return;
  judge.judge(noteName);
  activeHighway().setLaneActive(noteName, true);
  setTimeout(() => activeHighway().setLaneActive(noteName, false), 100);
});

// ── Note buttons ──
noteButtons.forEach(btn => {
  const letter = btn.dataset.note;
  btn.addEventListener('mousedown', () => {
    if (!engine.running) return;
    judge.judge(letter);
    activeHighway().setLaneActive(letter, true);
  });
  btn.addEventListener('mouseup',    () => activeHighway().setLaneActive(letter, false));
  btn.addEventListener('mouseleave', () => activeHighway().setLaneActive(letter, false));
});

// ── Keyboard input ──
// Piano layout: white keys on home row, black keys on top row
const KEY_MAP = {
  'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#', 'd': 'E',
  'f': 'F', 't': 'F#', 'g': 'G', 'y': 'G#', 'h': 'A', 'u': 'A#', 'j': 'B',
};
const keysDown = new Set();
document.addEventListener('keydown', (e) => {
  if (keysDown.has(e.key)) return; // ignore repeats
  const letter = KEY_MAP[e.key.toLowerCase()];
  if (letter && engine.running) {
    keysDown.add(e.key);
    judge.judge(letter);
    activeHighway().setLaneActive(letter, true);
  }
});
document.addEventListener('keyup', (e) => {
  keysDown.delete(e.key);
  const letter = KEY_MAP[e.key.toLowerCase()];
  if (letter) activeHighway().setLaneActive(letter, false);
});

// ── Hit feedback ──
let feedbackTimer = null;
bus.on('hit:judge', ({ tier }) => {
  feedbackEl.textContent = tier;
  feedbackEl.className = tier.toLowerCase();
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    feedbackEl.textContent = '';
    feedbackEl.className = '';
  }, 400);
  updateScoreUI();
});

bus.on('hit:miss', () => {
  feedbackEl.textContent = 'Miss';
  feedbackEl.className = 'miss';
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    feedbackEl.textContent = '';
    feedbackEl.className = '';
  }, 400);
  updateScoreUI();
});

function updateScoreUI() {
  scoreEl.textContent    = judge.score;
  comboEl.textContent    = `combo ${judge.combo}`;
  accuracyEl.textContent = `${judge.accuracy}%`;
}

// ── Synth: song note playback ──
const _playedNotes = new Set();  // indices of notes already triggered
const _activeNotes = new Map();  // index → scheduled noteOff timeout

bus.on('song:tick', ({ position, notes }) => {
  // Trigger notes as they arrive at their time
  for (let i = 0; i < notes.length; i++) {
    if (_playedNotes.has(i)) continue;
    const n = notes[i];
    if (position >= n.time && position < n.time + n.duration) {
      _playedNotes.add(i);
      synth.noteOn(n.note, n.velocity);
      // Schedule noteOff
      const remaining = n.duration - (position - n.time);
      const tid = setTimeout(() => {
        synth.noteOff(n.note);
        _activeNotes.delete(i);
      }, remaining);
      _activeNotes.set(i, tid);
    }
  }
});

// ── Synth: metronome + beat indicator ──
bus.on('song:beat', ({ beatInBar, accented }) => {
  synth.clickMetronome(accented);
  updateBeatIndicator(beatInBar, accented);
});

// ── Game loop (render) ──
bus.on('song:tick', ({ position, notes }) => {
  judge.checkMisses(position);
  activeHighway().draw(position, notes);
  const pct = Math.min(100, (position / engine.duration) * 100);
  progressBar.style.width = `${pct}%`;
});

// ── Song end ──
bus.on('song:end', () => {
  startBtn.textContent = 'Restart';
  stopBtn.style.display = 'none';
  // Stop any lingering synth voices
  for (const [, tid] of _activeNotes) {
    clearTimeout(tid);
  }
  _activeNotes.clear();
  showResults();
});

// ── Start / Restart ──
startBtn.addEventListener('click', () => {
  hideResults();
  if (engine.running) engine.stop();
  // Reset synth state
  _playedNotes.clear();
  for (const [, tid] of _activeNotes) clearTimeout(tid);
  _activeNotes.clear();
  loadSelectedSong();
  buildBeatPips();
  engine.start();
  startBtn.textContent = 'Playing...';
  stopBtn.style.display = '';
  // Draw initial frame in active view
  activeHighway().draw(0, engine.notes);
});

// ── Stop ──
stopBtn.addEventListener('click', () => {
  engine.stop();
  _playedNotes.clear();
  for (const [, tid] of _activeNotes) clearTimeout(tid);
  _activeNotes.clear();
  startBtn.textContent = 'Start';
  stopBtn.style.display = 'none';
  progressBar.style.width = '0%';
  activeHighway().draw(0, engine.notes);
});

// ── Results ──
function showResults() {
  document.getElementById('r-score').textContent    = judge.score;
  document.getElementById('r-accuracy').textContent = `${judge.accuracy}%`;
  document.getElementById('r-combo').textContent    = judge.maxCombo;
  document.getElementById('r-perfect').textContent  = judge.tierCounts.Perfect;
  document.getElementById('r-great').textContent    = judge.tierCounts.Great;
  document.getElementById('r-good').textContent     = judge.tierCounts.Good;
  document.getElementById('r-miss').textContent     = judge.tierCounts.Miss;
  resultsDiv.classList.add('visible');
  backdrop.classList.add('visible');
}

function hideResults() {
  resultsDiv.classList.remove('visible');
  backdrop.classList.remove('visible');
}

resultsClose.addEventListener('click', hideResults);
backdrop.addEventListener('click', hideResults);

// ── Init ──
midiInput.init();
// Draw initial empty frame in the default (piano) view
activeHighway().draw(0, []);
