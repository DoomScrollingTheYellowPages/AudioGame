import { writeFileSync, mkdirSync } from 'fs';
import { getSong, listSongs } from '../src/rhythm/DemoSongs.js';
import { MidiWriter } from '../src/rhythm/MidiWriter.js';

mkdirSync('midi', { recursive: true });

for (const { id, bpm } of listSongs()) {
  const song = getSong(id);
  const msPerBeat = 60000 / bpm;
  const midiNotes = song.notes.map(n => ({
    note: n.note,
    beats: n.duration / msPerBeat,
  }));
  const buf = MidiWriter.build({ bpm: song.bpm, notes: midiNotes, meter: song.meter });
  const outPath = `midi/${id}.mid`;
  writeFileSync(outPath, Buffer.from(buf));
  console.log(`Wrote ${outPath}`);
}
