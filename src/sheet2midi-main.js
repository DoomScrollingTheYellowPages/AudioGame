// ─────────────────────────────────────────────
// sheet2midi-main.js — entry point for the
// Sheet2MIDI page, wires EventBus + OMREngine
// ─────────────────────────────────────────────

import { EventBus } from './core/EventBus.js';
import { OMREngine } from './sheet2midi/OMREngine.js';
import { OMRDebugOverlay } from './sheet2midi/OMRDebugOverlay.js';

// ── Constants ──────────────────────────────────

const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs';
const PDF_RENDER_SCALE = 4.0; // 4x (~300 DPI) for OMR quality

// ── DOM refs ───────────────────────────────────

const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const processBtn = document.getElementById('process-btn');
const bpmInput = document.getElementById('bpm-input');
const timeSigSelect = document.getElementById('time-sig');
const progressArea = document.getElementById('progress-area');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const previewArea = document.getElementById('preview-area');
const previewCanvas = document.getElementById('preview-canvas');
const pageSelector = document.getElementById('page-selector');
const pageLabel = document.getElementById('page-label');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const resultsArea = document.getElementById('results-area');
const statNotes = document.getElementById('stat-notes');
const statStaves = document.getElementById('stat-staves');
const statMeasures = document.getElementById('stat-measures');
const downloadBtn = document.getElementById('download-btn');
const correctionsLog = document.getElementById('corrections-log');
const correctionsList = document.getElementById('corrections-list');
const errorMsg = document.getElementById('error-msg');
const overlayCanvas = document.getElementById('overlay-canvas');
const vizNav = document.getElementById('viz-nav');
const vizPrev = document.getElementById('viz-prev');
const vizNext = document.getElementById('viz-next');
const vizStepLabel = document.getElementById('viz-step-label');
const vizStepCount = document.getElementById('viz-step-count');
const vizLegend = document.getElementById('viz-legend');

// ── State ──────────────────────────────────────

const bus = new EventBus();
const engine = new OMREngine(bus);
const overlay = new OMRDebugOverlay(overlayCanvas);
let selectedFile = null;
let lastMidiBuffer = null;
let pdfDoc = null;
let pdfPage = 1;

// ── PDF.js lazy loader ─────────────────────────

let _pdfjsLib = null;

async function loadPdfJs() {
  if (_pdfjsLib) return _pdfjsLib;
  _pdfjsLib = await import(PDFJS_URL);
  _pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return _pdfjsLib;
}

// ── PDF rendering ──────────────────────────────

/** Render a PDF page into the visible preview canvas. */
async function renderPdfPageToCanvas(doc, pageNum) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.0 });
  previewCanvas.width = viewport.width;
  previewCanvas.height = viewport.height;
  const ctx = previewCanvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
}

/** Render a PDF page to a high-res Blob for OMR. */
async function renderPdfPageToBlob(doc, pageNum) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
  const offscreen = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = offscreen.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return offscreen.convertToBlob({ type: 'image/png' });
}

/** Update page nav label and button states. */
function updatePageNav() {
  pageLabel.textContent = `Page ${pdfPage} / ${pdfDoc.numPages}`;
  prevPageBtn.disabled = pdfPage <= 1;
  nextPageBtn.disabled = pdfPage >= pdfDoc.numPages;
}

// ── File Selection ─────────────────────────────

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
    selectFile(file);
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    selectFile(fileInput.files[0]);
  }
});

/** @param {File} file */
async function selectFile(file) {
  selectedFile = file;
  pdfDoc = null;
  pdfPage = 1;

  // Reset previous results
  resultsArea.classList.remove('active');
  errorMsg.classList.remove('active');
  progressArea.classList.remove('active');
  pageSelector.classList.remove('active');

  uploadArea.querySelector('h2').textContent = file.name;
  uploadArea.querySelector('p').textContent =
    `${(file.size / 1024).toFixed(1)} KB — loading preview…`;

  if (file.type === 'application/pdf') {
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      await renderPdfPageToCanvas(pdfDoc, pdfPage);
      updatePageNav();
      pageSelector.classList.add('active');
      uploadArea.querySelector('p').textContent =
        `${(file.size / 1024).toFixed(1)} KB — ${pdfDoc.numPages} page(s) — click Process`;
    } catch (err) {
      errorMsg.textContent = `PDF load error: ${err.message}`;
      errorMsg.classList.add('active');
      return;
    }
  } else {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        previewCanvas.width = img.width;
        previewCanvas.height = img.height;
        const ctx = previewCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    uploadArea.querySelector('p').textContent =
      `${(file.size / 1024).toFixed(1)} KB — click Process to begin`;
  }

  previewArea.classList.add('active');
  processBtn.disabled = false;
}

// ── Clipboard Paste ────────────────────────────

document.addEventListener('paste', (e) => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (!item) return;
  const file = item.getAsFile();
  if (file) selectFile(file);
});

// ── Page Navigation ─────────────────────────────

prevPageBtn.addEventListener('click', async () => {
  if (!pdfDoc || pdfPage <= 1) return;
  pdfPage--;
  updatePageNav();
  await renderPdfPageToCanvas(pdfDoc, pdfPage);
});

nextPageBtn.addEventListener('click', async () => {
  if (!pdfDoc || pdfPage >= pdfDoc.numPages) return;
  pdfPage++;
  updatePageNav();
  await renderPdfPageToCanvas(pdfDoc, pdfPage);
});

// ── Processing ─────────────────────────────────

processBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  processBtn.disabled = true;
  progressArea.classList.add('active');
  resultsArea.classList.remove('active');
  overlayCanvas.classList.remove('active');
  vizNav.classList.remove('active');
  errorMsg.classList.remove('active');
  correctionsLog.classList.remove('active');
  overlay.reset();

  const bpm = parseInt(bpmInput.value, 10) || 120;
  const [num, den] = timeSigSelect.value.split('/').map(Number);

  try {
    // For PDFs, render the selected page to a high-res image blob first
    let sourceBlob = selectedFile;
    if (pdfDoc) {
      progressText.textContent = `Rendering page ${pdfPage}…`;
      sourceBlob = await renderPdfPageToBlob(pdfDoc, pdfPage);
    }

    const result = await engine.process(sourceBlob, {
      bpm,
      timeSig: [num, den]
    });

    lastMidiBuffer = result.midi;

    // Show results
    statNotes.textContent = result.notes.filter(n => n.midiNote > 0).length;
    statStaves.textContent = result.staffInfo.groups.length;

    // Count bar lines as measure delimiter
    const barCount = result.symbols.filter(s => s.type === 'bar_line').length;
    statMeasures.textContent = Math.max(1, barCount + 1);

    resultsArea.classList.add('active');
    progressArea.classList.remove('active');

    // Show pipeline visualization overlay
    if (overlay.stepCount > 0) {
      const firstData = overlay._steps[0].data;
      overlay.setDimensions(
        previewCanvas.width, previewCanvas.height,
        firstData.width, firstData.height,
        firstData.cropOffsetX || 0,
        firstData.cropOffsetY || 0,
        firstData.preCropW || null,
        firstData.preCropH || null
      );
      overlay.goTo(overlay.stepCount - 1); // start on final step
      _updateVizUI();
      overlayCanvas.classList.add('active');
      vizNav.classList.add('active');
    }

    // Debug display
    renderDebugResults(result, selectedFile?.name || '');

    // Show corrections
    if (result.corrections.length > 0) {
      correctionsList.innerHTML = result.corrections
        .map(c => `<p>${c}</p>`)
        .join('');
      correctionsLog.classList.add('active');
    }
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.classList.add('active');
    progressArea.classList.remove('active');
  }

  processBtn.disabled = false;
});

// ── Progress Updates ───────────────────────────

bus.on('omr:progress', ({ stage, name }) => {
  const pct = Math.round((stage / 11) * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = `Stage ${stage}/11: ${name}`;
});

// ── Pipeline Debug Overlay ──────────────────────

bus.on('omr:debug', (stepData) => {
  overlay.addStep(stepData);
});

function _updateVizUI() {
  const total = overlay.stepCount;
  const idx = overlay.currentIndex;
  vizStepLabel.textContent = overlay.currentLabel;
  vizStepCount.textContent = `${idx + 1} / ${total}`;
  vizPrev.disabled = idx <= 0;
  vizNext.disabled = idx >= total - 1;
  vizLegend.innerHTML = overlay.legendHtml();
}

vizPrev.addEventListener('click', () => {
  overlay.prev();
  _updateVizUI();
});

vizNext.addEventListener('click', () => {
  overlay.next();
  _updateVizUI();
});

// ── MIDI Download ──────────────────────────────

// ── Debug Panel ─────────────────────────────

const debugToggle = document.getElementById('debug-toggle');
const debugResults = document.getElementById('debug-results');
const debugContent = document.getElementById('debug-content');

// Expected results for test images
const TEST_EXPECTED = {
  'CMajorScale.png': {
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    midi: [60, 62, 64, 65, 67, 69, 71, 72],
    clef: 'treble',
    staves: 1
  }
};

debugToggle.addEventListener('change', () => {
  if (!debugToggle.checked) debugResults.classList.remove('active');
});

/** @param {object} result - from engine.process() */
function renderDebugResults(result, fileName) {
  if (!debugToggle.checked) return;

  const expected = TEST_EXPECTED[fileName];
  const notes = result.notes.filter(n => n.midiNote > 0);

  let html = '';

  // Staff info
  html += '<h4>Staff Detection</h4>';
  html += `<p>Groups: ${result.staffInfo.groups.length}, staffSpace: ${result.staffInfo.staffSpace}px, lineThick: ${result.staffInfo.lineThickness}px</p>`;

  // Notes table
  html += '<h4>Detected Notes</h4>';
  if (expected) {
    html += `<p class="debug-expected">Expected: ${expected.notes.join(', ')} (MIDI: ${expected.midi.join(', ')})</p>`;
  }
  html += '<table><tr><th>#</th><th>Name</th><th>Oct</th><th>MIDI</th><th>Clef</th><th>StaffPos</th><th>X</th><th>Match</th></tr>';
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const detected = `${n.noteName}${n.octave}`;
    let matchClass = '';
    let matchText = '';
    if (expected && i < expected.notes.length) {
      const isMatch = detected === expected.notes[i] && n.midiNote === expected.midi[i];
      matchClass = isMatch ? 'match' : 'mismatch';
      matchText = isMatch ? 'OK' : `exp ${expected.notes[i]}(${expected.midi[i]})`;
    }
    html += `<tr>`;
    html += `<td>${i + 1}</td>`;
    html += `<td>${n.noteName}</td>`;
    html += `<td>${n.octave}</td>`;
    html += `<td>${n.midiNote}</td>`;
    html += `<td>${n.clef}</td>`;
    html += `<td>${n.staffPos}</td>`;
    html += `<td>${Math.round(n.symbol.component.centroid.x)}</td>`;
    html += `<td class="${matchClass}">${matchText}</td>`;
    html += `</tr>`;
  }
  html += '</table>';

  // Summary
  const noteCount = notes.length;
  const expectedCount = expected ? expected.notes.length : '?';
  let correctCount = 0;
  if (expected) {
    for (let i = 0; i < Math.min(notes.length, expected.notes.length); i++) {
      if (`${notes[i].noteName}${notes[i].octave}` === expected.notes[i]
          && notes[i].midiNote === expected.midi[i]) {
        correctCount++;
      }
    }
  }
  html += '<h4>Summary</h4>';
  html += `<p>Notes: ${noteCount}/${expectedCount}`;
  if (expected) {
    const pct = expectedCount > 0 ? Math.round(correctCount / expectedCount * 100) : 0;
    html += ` | Correct: <span class="${pct === 100 ? 'match' : 'mismatch'}">${correctCount}/${expectedCount} (${pct}%)</span>`;
  }
  html += '</p>';

  // Symbols breakdown
  html += '<h4>All Symbols</h4>';
  const typeCounts = {};
  for (const s of result.symbols) typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  html += '<table><tr><th>Type</th><th>Count</th></tr>';
  for (const [type, count] of Object.entries(typeCounts).sort()) {
    html += `<tr><td>${type}</td><td>${count}</td></tr>`;
  }
  html += '</table>';

  // Corrections
  if (result.corrections.length > 0) {
    html += '<h4>Corrections</h4>';
    for (const c of result.corrections) html += `<p>${c}</p>`;
  }

  debugContent.innerHTML = html;
  debugResults.classList.add('active');
}

// ── MIDI Download ──────────────────────────

downloadBtn.addEventListener('click', () => {
  if (!lastMidiBuffer) return;
  const blob = new Blob([lastMidiBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (selectedFile?.name?.replace(/\.[^.]+$/, '') || 'sheet') + '.mid';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
