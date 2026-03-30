# Optical Music Recognition (OMR) Landscape

## The Problem

Given an image of printed or handwritten sheet music, produce a structured symbolic representation (MusicXML, MIDI, MEI) that captures pitches, rhythms, articulations, dynamics, and layout. This is substantially harder than OCR for text because:

- Musical symbols overlap spatially (notes share staff lines, beams connect groups, slurs span measures).
- Meaning is relational, not sequential: a dot next to a note changes its duration, but a dot below a note is staccato.
- Rhythm is implicit in beaming/grouping rules, not just in individual note shapes.
- The same visual curve can be a tie (sustain) or a slur (phrasing) depending on whether the connected notes share a pitch.

---

## 1. oemer -- End-to-End Deep Learning OMR

**Repo:** https://github.com/BreezeWhite/oemer
**Author:** BreezeWhite (Yu-Te Wu)
**Published:** 2022 (Zenodo: https://zenodo.org/records/6350268)

### Pipeline (9 stages)

1. **Image dewarping** -- corrects skewed/curved phone photos (6-step correction)
2. **Staffline extraction** -- identifies staff lines, computes `unit_size` (inter-line spacing), which propagates to all later stages
3. **Notehead detection** -- locates noteheads, classifies hollow vs. solid
4. **Note grouping** -- clusters noteheads into chords by vertical proximity and stem direction
5. **Symbol recognition** -- extracts clefs, accidentals, barlines, rests
6. **Rhythm analysis** -- parses dots, beams, flags to determine durations
7. **MusicXML construction** -- event-based decoding into structured output
8. **Symbol alignment** -- synchronizes notes across staves (e.g., piano LH/RH)
9. **Beat adjustment** -- ensures rhythmic consistency across tracks

### Neural Architecture

- **Two UNet semantic segmentation models:**
  - Model 1: Separates stafflines from all other symbols. Trained on **CvcMuscima-Distortions**.
  - Model 2: Distinguishes noteheads, clefs, stems, rests. Trained on **DeepScores-extended**.
- **Three SVM classifiers** for detailed symbol-type identification after segmentation.
- Inference backends: ONNX Runtime (default) or TensorFlow.

### How It Differs from Classical Approaches

Classical OMR (e.g., Audiveris) uses binarization, horizontal projection for staff detection, connected-component analysis, then template matching or hand-crafted rules. oemer replaces the first two stages (binarization + staff detection) with learned segmentation, which handles noise, skew, and phone-photo artifacts better. However, it still uses classical SVM for fine-grained classification and rule-based logic for rhythm/grouping -- it is a **hybrid**, not fully end-to-end in the deep learning sense.

### Performance

- Execution: 3-5 minutes with GPU per page.
- No published benchmark numbers (precision/recall/F1) against standard datasets.
- Handles multi-staff scores (piano with two hands).

### Known Limitations

- Trained exclusively on **typeset** Western notation; does not handle handwritten scores.
- Assumes approximately horizontal stafflines after dewarping.
- No support for tablature, chord symbols, lyrics, or non-Western notation.
- SVM classifiers can fail on unusual symbol shapes or dense passages.
- GitHub issues report problems with complex polyphonic passages and certain key signatures.

---

## 2. OMR Datasets and MUSCIMA++

### Dataset Catalog

**Repo:** https://github.com/apacha/OMR-Datasets (maintained by Alexander Pacha)
**Website:** https://apacha.github.io/OMR-Datasets/

Key datasets for OMR research:

| Dataset | Size | Type | Annotation | Use Case |
|---------|------|------|------------|----------|
| **DeepScores V1** | 300,000 images | Typeset | Bounding boxes, XML | Object detection, classification |
| **DeepScores V2** | 255,385 images, 151M symbol instances, 135 classes | Typeset | Oriented bounding boxes, pitch/rhythm info | Detection, segmentation |
| **MUSCIMA++** | 91,255 symbols, 140 images | Handwritten | Pixel masks, notation graph (MuNG) | Symbol detection, end-to-end |
| **CVC-MUSCIMA** | 1,000 images (50 writers x 20 pages) | Handwritten | Staff/non-staff layers | Staff removal, writer ID |
| **PrIMuS** | 87,678 incipits | Typeset | Images + MEI + multiple encodings | End-to-end sequence models |
| **DoReMi** | 6,432 images | Typeset | MusicXML, MEI, MIDI | Multi-task training |
| **AudioLabs v1/v2** | 940 images, 24K-86K boxes | Typeset | Bounding boxes | Measure/stave detection |
| **HOMUS** | 15,200 symbols | Handwritten | Text files | Online symbol classification |
| **MuseScore** | 340,000+ files | Typeset | MuseScore, PDF, MusicXML | General research |
| **IMSLP** | 420,000+ images | Typeset (scanned) | PDF only (no annotations) | Raw data source |

### MUSCIMA++ In Depth

**Repo:** https://github.com/OMR-Research/muscima-pp
**Paper:** Hajic & Pecina, ICDAR 2017
**Dataset:** http://hdl.handle.net/11372/LRT-2372

**Why it matters:** MUSCIMA++ is the only dataset that provides both pixel-level masks AND a notation graph (MuNG) capturing the relationships between primitives. This makes it uniquely useful for training systems that need to understand not just "what symbols are here" but "how do they connect."

**Statistics:**
- 91,255 annotated symbol instances
- 23,352 notes (21,356 full notehead, 1,648 empty notehead, 348 grace notes)
- 163 object classes defined (73 actually observed in the dataset)
- 140 annotated images from 50 different writers

**Annotation Structure:**
Each object has:
- Bounding box (top, left, width, height)
- Pixel mask (run-length encoded) defining exact pixels
- Class label (from 163 possible classes)
- Directed edges (inlinks/outlinks) to other objects

The directed edges form the **MUSCIMA++ Notation Graph (MuNG)**. Edges encode attachment: a stem is attached to a notehead, a sharp is attached to a key signature, a beam connects to stems. This graph structure lets you deterministically reconstruct complete musical objects from primitives.

**Version History:**
- v1.0: Original format with combined unique IDs
- v2.0 (June 2019): Major restructuring, SMuFL-aligned class names, improved usability
- v2.1: Further refinements

**Test Splits:**
- Writer-independent: test writers excluded from training (tests generalization)
- Writer-dependent: test writers in training data (tests symbol recognition only)

**Known Issues:**
- Staff removal artifacts (automated line removal sometimes eats stem pixels)
- Some human annotation errors in complex passages
- CC-BY-NC-SA 4.0 license (non-commercial)

---

## 3. Gamera and Rodan -- Early OMR Research Systems

### Gamera

**Paper:** MacMillan, Droettboom, Fujinaga, "Gamera: Optical music recognition in a new shell," ICMC 2002
**Lab:** DDMAL (Distributed Digital Music Archives & Libraries), McGill University
**Links:**
- https://quod.lib.umich.edu/i/icmc/bbp2372.2002.098/1
- https://github.com/DDMAL/Interactive-Classifier

**What it is:** An open-source Python framework for building document analysis applications, not just OMR. Designed for domain experts (musicologists, librarians) who lack strong programming skills.

**Pioneering Contributions:**
- **Interactive classification workflow:** Users train classifiers by correcting mistakes in an iterative loop -- the system classifies glyphs automatically, the user fixes errors, and those corrections become new training data. This human-in-the-loop approach was ahead of its time.
- **Connected-component analysis:** Segments the image into individual glyphs after binarization and staff removal.
- **Feature extraction library:** Provides numerous geometric and statistical features for glyph classification.
- **Pluggable architecture:** Users can swap classifiers (kNN was default) and feature sets.

**Pipeline:**
1. Image preprocessing (binarization, de-speckling)
2. Staff line detection and removal
3. Connected-component extraction
4. Feature extraction from each component
5. Classification (kNN with interactive correction)
6. Musical semantics reconstruction

**Lessons Learned:**
- Staff removal is destructive -- removing lines damages symbols that intersect them (stems, noteheads on lines). This motivated later grayscale and segmentation-based approaches.
- kNN classification with hand-crafted features hits a ceiling around 85-90% for diverse handwritten notation.
- Interactive correction is expensive but necessary for specialized manuscripts (medieval, early music).
- The framework approach (toolkit, not turnkey solution) was both its strength and weakness -- flexible but requires expertise.

### Rodan

**Lab:** DDMAL, McGill University
**Docs:** https://ddmal.ca/e2e-omr-documentation/
**Repo:** https://github.com/DDMAL/Interactive-Classifier

**What it is:** A distributed, collaborative workflow management system built on top of Gamera's technology, focused on medieval square-notation music.

**Four-Stage Pipeline:**
1. **Document Analysis:** Image preprocessing (resizing, de-speckling), layer separation using Pixel.js (background, staff lines, text, music elements)
2. **Symbol Classification:** Interactive Classifier (web-based version of Gamera's classifier), feature selection/weighting
3. **Music Encoding:** Staff finding (Miyao algorithm), heuristic pitch finding, text alignment
4. **MEI Output:** Translates recognized music into MEI (Music Encoding Initiative) format

**Contributions:**
- Demonstrated that OMR for historical manuscripts requires human-in-the-loop workflows.
- Web-based interface made the interactive classifier accessible to non-programmers.
- Showed that different musical traditions (medieval neumes vs. CWMN) need fundamentally different pipelines.

---

## 4. Google's OMR-Adjacent Research

Google has not published a dedicated OMR paper for sheet-music-to-symbolic conversion. However, they have contributed significantly to adjacent problems:

### Magenta: Onsets and Frames (Audio Transcription, Not Image-Based)

**Paper:** Hawthorne et al., "Onsets and Frames: Dual-Objective Piano Transcription," ISMIR 2018
**Repo:** https://github.com/magenta/magenta (part of the Magenta project)

This is **audio-to-MIDI** transcription, not image-to-symbolic. It uses a dual-headed neural network (one head predicts note onsets, one predicts active frames) to transcribe piano audio into MIDI. It is not OMR, but it solves the related problem of producing symbolic music from a non-symbolic source.

### Sequence-to-Sequence Piano Transcription with Transformers (2021)

T5-inspired transformer model with 54M parameters, trained on the Maestro dataset. Again audio-to-MIDI, not image OMR.

### Score Following

Dorfer et al. (not Google, but Johannes Kepler University) pioneered real-time alignment between audio performance and sheet music images using multi-modal CNNs. Google has not published in this specific area but has contributed to general document understanding models (e.g., LayoutLM family) that could in principle be applied to music scores.

**Bottom line:** Google's main contribution is in audio transcription (Magenta), not image-based OMR. The most relevant OMR research comes from academic groups (DDMAL/McGill, Calvo-Zaragoza's group in Alicante, Pacha at TU Wien, Hajic at Charles University Prague).

---

## 5. Key Academic Papers

### The Definitive Survey

**"Understanding Optical Music Recognition"**
Calvo-Zaragoza, Hajic Jr., Pacha. ACM Computing Surveys, Vol. 53, No. 4, Article 77, 2020.
**arXiv:** https://arxiv.org/abs/1908.03608
**PDF:** https://alexanderpacha.com/wp-content/uploads/2020/11/understanding-optical-music-recognition-final.pdf

This is the single most important paper in the field. It provides:
- A formal definition of OMR and its relationship to related fields
- Analysis of how OMR inverts the music encoding process
- A taxonomy of OMR applications
- A framework for understanding how deep learning changes the field
- 35 pages of comprehensive coverage

**Traditional OMR Pipeline (from the survey):**
1. Image preprocessing (binarization, noise removal, deskewing)
2. Staff detection and removal
3. Music symbol detection (connected components or object detection)
4. Music symbol classification
5. Notation reconstruction (assembling primitives into musical semantics)

### Staff Line Detection

**"Staff Detection with Stable Paths"** -- Cardoso et al.
A graph-based approach that finds staff lines as shortest paths through a graph of black pixels, robust to curvature and discontinuities.

**"Staff-line Detection and Removal Using a Convolutional Neural Network"** -- Calvo-Zaragoza et al., Machine Vision and Applications, 2017.
Treats staff removal as pixel classification (staff/symbol/background) using a CNN. Avoids the destructive binary staff-removal that plagued Gamera-era systems.

**"Staff-Line Detection on Grayscale Images with Pixel Classification"** -- operates on grayscale rather than binarized images, avoiding the information loss of binarization.

**Classical approaches (for reference):**
- Horizontal projection profiles (count black pixels per row)
- Run-length encoding (RLE) to estimate staff line thickness and spacing
- These are fast and work well on clean typeset scores but fail on skewed, curved, or handwritten input

### Music Symbol Classification

**"A Baseline for General Music Object Detection with Deep Learning"** -- Pacha et al., Applied Sciences, 2018.
https://github.com/apacha/MusicObjectDetection
Evaluated Faster R-CNN and other detectors on DeepScores. Established baselines that subsequent work builds on.

**"The DeepScoresV2 Dataset and Benchmark for Music Object Detection"** -- Tuggener et al., 2020.
135 classes, 151M symbol instances, oriented bounding boxes. Showed that standard bounding boxes are inadequate for elongated symbols (beams, slurs, ties) -- oriented boxes are needed.

### End-to-End Sequence Models

**"Camera-PrIMuS: Neural End-to-End OMR on Realistic Monophonic Scores"** -- Calvo-Zaragoza & Rizo, ISMIR 2018.
CRNN (CNN encoder + RNN decoder with CTC loss) that takes a staff-line image and outputs a symbolic encoding directly, bypassing all intermediate stages. Works well for monophonic single-staff music.

**"Sheet Music Transformer++ (SMT++)"** -- Rios-Vila et al., arXiv 2405.12105, 2024.
https://github.com/antoniorv6/SMT
The current state of the art for full-page polyphonic OMR. An autoregressive transformer that takes an entire page image and outputs complete notation in a music encoding format. Uses curriculum learning with incremental synthetic data. Outperforms commercial tools in both zero-shot and fine-tuned settings. First truly end-to-end approach for page-level pianoform OMR.

### Notation Reconstruction and Grammar

**"Toward a More Complete OMR Solution"** -- arXiv 2409.00316, 2024.
Addresses the gap between symbol detection and valid musical output. Discusses how detected symbols must be assembled into a consistent notation graph that respects the grammar of music notation.

### Evaluation Frameworks

**"The Common Optical Music Recognition Evaluation Framework"** -- arXiv 2312.12908, 2023.
https://github.com/ufal/omreval
Proposes standardized evaluation metrics for OMR, addressing the field's historical problem of inconsistent benchmarking.

---

## 6. MusicXML: What OMR Must Produce

**Specification:** https://www.w3.org/2021/06/musicxml40/
**GitHub:** https://github.com/w3c/musicxml
**Tutorial:** https://www.w3.org/2021/06/musicxml40/tutorial/structure-of-musicxml-files/

### Minimum Viable MusicXML

The "Hello World" of MusicXML (a single whole note middle C in 4/4):

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC
    "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
    "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1">
      <part-name>Music</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>
```

### Key Structural Elements an OMR System Must Produce

**Required for any output:**
- `<score-partwise>` root with `<part-list>` (at least one `<score-part>`)
- `<measure>` elements with `<attributes>` (divisions, key, time, clef)
- `<note>` elements with `<pitch>` (step, octave, optional alter), `<duration>`, `<type>`

**Required for multi-voice/polyphonic:**
- `<voice>` element inside `<note>` (1, 2, 3, 4...)
- `<chord/>` tag to indicate simultaneous notes
- `<backup>` and `<forward>` to move the time cursor for multiple voices in one staff

**Required for piano/grand staff:**
- Multiple `<part>` elements or `<staff>` numbering within a single part
- `<part-group>` in the part-list for braces/brackets

**Hardest elements to get right:**
- **`<divisions>`**: Determines the time resolution; must be consistent across the score and large enough to represent all note durations (including tuplets, dots, double-dots)
- **`<backup>`/`<forward>`**: Multi-voice in a single staff requires rewinding the time cursor; getting this wrong produces invalid rhythm
- **Ties vs. slurs**: `<tie type="start"/>` inside `<note>` vs. `<slur>` in `<notations>` -- visually identical curves with different semantics
- **Beaming**: `<beam>` elements with begin/continue/end must be consistent across note groups
- **Accidentals**: `<alter>` (for playback) vs. `<accidental>` (for display) are separate; key signature accidentals are implicit
- **Tuplets**: `<time-modification>` changes actual duration; `<tuplet>` in notations controls display
- **Grace notes**: `<grace/>` tag with optional `<grace steal-time-previous="..."/>`

---

## 7. Common OMR Failure Modes

These problems are reported across essentially every OMR system -- oemer, Audiveris, SharpEye, PhotoScore, academic systems, and deep learning models alike.

### Universally Hard Problems

**Overlapping/touching symbols:**
The single biggest source of errors. Staff lines run through noteheads and stems. Beams connect to stems. Accidentals sit adjacent to noteheads. Slurs curve over entire passages. When symbols overlap or touch, segmentation-based approaches must decide which pixels belong to which symbol -- and they frequently get it wrong. Dense passages (e.g., 16th-note runs with accidentals) are worst.

**Slurs vs. ties:**
Visually identical arced curves. A tie connects two notes of the same pitch (sustain); a slur connects notes of different pitches (phrasing). Disambiguation requires knowing the pitches of both connected notes, which means the system must have already recognized those notes before it can classify the curve. This creates a chicken-and-egg problem.

**Tuplets:**
Triplets, quintuplets, etc. may or may not have an explicit number/bracket. "Implicit" triplets (three beamed notes that should be played as triplets based on context, without a visible "3") are common in certain styles and are nearly impossible for OMR systems. Tuplet detection accounts for about 1.5% of symbol error rate even in state-of-the-art systems.

**Grace notes:**
Small noteheads with slashes or without. Size variation makes detection unreliable. They interact with the rhythmic structure in complex ways (steal time from adjacent notes).

**Multi-voice on a single staff:**
When two voices share one staff (e.g., soprano+alto on treble staff), stems go in opposite directions and notes at the same beat position overlap spatially. The system must determine which notes belong to which voice -- a grouping problem that requires understanding voice leading, not just visual proximity.

**Handwritten notation:**
Dramatically harder than typeset. Writers have idiosyncratic styles: noteheads vary from perfect ovals to jagged dots, stems lean at various angles, beams may be drawn in multiple strokes. MUSCIMA++ exists specifically to address this, but accuracy on handwritten scores remains well below typeset scores.

**Low-resolution and degraded images:**
Phone photos, old photocopies, microfilm scans. Staff lines blur, thin symbols (dots, staccato marks) disappear, bleed-through from the reverse side creates phantom symbols.

**Complex page layouts:**
- Lyrics beneath staves (text mixed with music symbols)
- Chord symbols above staves (letters + symbols)
- Multiple systems per page (must detect system breaks)
- Repeats, codas, segno marks (affect playback order)
- Ossia staves (small alternative staves above the main staff)
- Page headers, footers, page numbers
- Multiple columns (rare but exists in hymn books)

### Less-Discussed But Real Problems

**Dotted notes vs. staccato dots:** A dot to the right of a notehead = dotted note (1.5x duration). A dot above or below = staccato (short articulation). Position matters enormously but the distinction is often a few pixels.

**Augmentation dots vs. repeat dots:** Dots next to a note vs. dots next to a barline (repeat sign). Similar problem.

**Key signature changes mid-line:** Naturals canceling previous sharps/flats, followed by new key signature. The transition region is dense with accidentals.

**Cross-staff notation:** In piano music, a beam can span from treble to bass staff. Notes physically appear in one staff but belong to the other.

**Cue notes and editorial markings:** Small notes, parenthetical accidentals, ossia alternatives. These have different semantics than regular notes but look similar.

---

## 8. Deep Learning vs. Classical: Current State of the Art

### The Shift

As of 2024-2025, deep learning has largely supplanted classical approaches for the core recognition tasks:

**Staff detection:** Classical horizontal projection is replaced by semantic segmentation (UNet, FCN). The learned approach handles skew, curvature, and degradation far better.

**Symbol detection:** Classical connected-component analysis is replaced by object detection networks (Faster R-CNN, YOLO variants) or end-to-end sequence models.

**Symbol classification:** Classical template matching / kNN is replaced by CNNs. This was the first stage where deep learning clearly won (circa 2017-2018).

**End-to-end:** Transformer-based models (SMT++, TrOMR) now process entire pages without any of the intermediate stages. This eliminates error propagation between stages entirely.

### Has Deep Learning Fully Replaced Classical?

**No.** The current best practice is a hybrid:

1. **Fully end-to-end transformers** (SMT++) achieve the best accuracy on benchmarks for typeset pianoform music but require massive training data and GPU resources. They are not practical for edge/browser deployment.

2. **Hybrid pipelines** (like oemer) use deep learning for segmentation/detection but classical algorithms for grouping, rhythm analysis, and MusicXML construction. The "last mile" of assembling detected symbols into valid musical semantics is still largely rule-based because:
   - Music notation has a strict grammar that rules can enforce
   - Training data for full end-to-end systems is scarce for complex scores
   - Post-processing rules catch errors that neural networks miss

3. **Classical-only systems** (Audiveris) remain competitive for clean typeset scores with conventional layouts. Audiveris uses template matching for noteheads, morphological operations for beams, neural nets for "all other fixed-size shapes," and extensive rule-based reconstruction. For its target domain (clean PDF scores), it works well.

4. **For handwritten/historical notation**, the Gamera/Rodan human-in-the-loop approach is still the most practical because:
   - Every manuscript has unique characteristics
   - Training data for specific notations (medieval neumes, mensural notation) is tiny
   - Musicologists can correct errors that no model can avoid

### The Frontier (2025)

- **Transformer-based full-page models** (SMT++, Legato) represent the cutting edge
- **Self-supervised learning** enables training with minimal labeled data (87.66% accuracy in few-shot settings)
- **Graph neural networks** model the relational structure of notation (primitives connected by edges)
- **Layout-aware transformers** extract system/staff layout without explicit detection
- **Curriculum learning** with synthetic data generation addresses the training data bottleneck

### Practical Recommendation for This Project

For a browser-based OMR tool processing clean typeset scores (our sheet2midi use case):

- **Staff detection:** Classical horizontal projection + RLE is sufficient for clean images. If we need robustness to phone photos, a small segmentation model is needed.
- **Symbol detection:** Classical connected-component analysis after staff removal works for simple scores. For anything complex, a lightweight CNN detector would help.
- **Rhythm/grouping:** Rule-based, since music notation grammar is well-defined and our scope is limited.
- **Output:** We produce MIDI (not MusicXML), which is simpler -- we only need pitch, onset time, and duration.

The deep learning approaches require Python backends (PyTorch, TensorFlow) and are not directly usable in a zero-dependency browser app. However, understanding the pipeline structure (what oemer and SMT++ do) informs which classical techniques to implement and in what order.

---

## Key Repositories and Links

| Resource | URL |
|----------|-----|
| oemer | https://github.com/BreezeWhite/oemer |
| OMR-Datasets | https://github.com/apacha/OMR-Datasets |
| MUSCIMA++ | https://github.com/OMR-Research/muscima-pp |
| DDMAL Interactive Classifier | https://github.com/DDMAL/Interactive-Classifier |
| Rodan/DDMAL E2E OMR Docs | https://ddmal.ca/e2e-omr-documentation/ |
| Sheet Music Transformer (SMT) | https://github.com/antoniorv6/SMT |
| Audiveris | https://github.com/Audiveris/audiveris |
| Music Object Detection | https://github.com/apacha/MusicObjectDetection |
| OMR Evaluation Framework | https://github.com/ufal/omreval |
| MusicXML 4.0 Spec | https://www.w3.org/2021/06/musicxml40/ |
| Understanding OMR (survey) | https://arxiv.org/abs/1908.03608 |
| DeepScores V2 paper | https://www.researchgate.net/publication/346005830 |
| Common OMR Eval Framework | https://arxiv.org/html/2312.12908v1 |
| Alexander Pacha's OMR guide | https://alexanderpacha.com/2024/01/06/optical-music-recognition-a-beginners-guide/ |
| OMR Research hub | https://omr-research.net/ |
