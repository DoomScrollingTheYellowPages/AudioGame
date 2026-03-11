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

// ── Bootstrap ──
const bus        = new EventBus();
const midiInput  = new MIDIInput(bus);
const audioInput = new AudioInput(bus);
const engine     = new SongEngine(bus);
const highway    = new Highway(document.getElementById('highway-canvas'), bus);
const judge      = new HitJudge(bus, engine);

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
const noteButtons  = document.querySelectorAll('.note-btn');
const resultsDiv   = document.getElementById('results');
const backdrop     = document.getElementById('backdrop');
const resultsClose = document.getElementById('results-close');

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
  judge.reset();
  updateScoreUI();
}

songSelect.addEventListener('change', () => {
  clearCustomSong();
  loadSelectedSong();
});
loadSelectedSong();

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
    customSong = { bpm: parsed.bpm, notes: parsed.notes };
    midiUploadName.textContent = file.name;
    songBpmEl.textContent = `${parsed.bpm} BPM (${parsed.notes.length} notes)`;
    engine.load(customSong);
    judge.reset();
    updateScoreUI();
    highway.draw(0, engine.notes);
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
    const letter = judge.pitchLetter(note);
    if (letter) {
      judge.judge(letter);
      highway.setLaneActive(letter, true);
      setTimeout(() => highway.setLaneActive(letter, false), 100);
    }
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

// Audio pitch → judge (only natural notes)
bus.on('audio:pitch', ({ noteName }) => {
  if (!engine.running) return;
  const letter = noteName.length === 1 && 'CDEFGAB'.includes(noteName) ? noteName : null;
  if (letter) {
    judge.judge(letter);
    highway.setLaneActive(letter, true);
    setTimeout(() => highway.setLaneActive(letter, false), 100);
  }
});

// ── Note buttons ──
noteButtons.forEach(btn => {
  const letter = btn.dataset.note;
  btn.addEventListener('mousedown', () => {
    if (!engine.running) return;
    judge.judge(letter);
    highway.setLaneActive(letter, true);
  });
  btn.addEventListener('mouseup', () => highway.setLaneActive(letter, false));
  btn.addEventListener('mouseleave', () => highway.setLaneActive(letter, false));
});

// ── Keyboard input ──
const KEY_MAP = {
  'a': 'C', 's': 'D', 'd': 'E', 'f': 'F', 'g': 'G', 'h': 'A', 'j': 'B',
};
const keysDown = new Set();
document.addEventListener('keydown', (e) => {
  if (keysDown.has(e.key)) return; // ignore repeats
  const letter = KEY_MAP[e.key.toLowerCase()];
  if (letter && engine.running) {
    keysDown.add(e.key);
    judge.judge(letter);
    highway.setLaneActive(letter, true);
  }
});
document.addEventListener('keyup', (e) => {
  keysDown.delete(e.key);
  const letter = KEY_MAP[e.key.toLowerCase()];
  if (letter) highway.setLaneActive(letter, false);
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

// ── Game loop (render) ──
bus.on('song:tick', ({ position, notes }) => {
  judge.checkMisses(position);
  highway.draw(position, notes);
  const pct = Math.min(100, (position / engine.duration) * 100);
  progressBar.style.width = `${pct}%`;
});

// ── Song end ──
bus.on('song:end', () => {
  startBtn.textContent = 'Restart';
  showResults();
});

// ── Start / Restart ──
startBtn.addEventListener('click', () => {
  hideResults();
  if (engine.running) engine.stop();
  loadSelectedSong();
  engine.start();
  startBtn.textContent = 'Playing...';
  // Draw initial frame
  highway.draw(0, engine.notes);
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
// Draw empty highway
highway.draw(0, []);
