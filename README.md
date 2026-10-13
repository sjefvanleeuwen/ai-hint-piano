# Keyframe — Piano Study

A browser-based Three.js MIDI piano performance reference, with a seated mannequin, connected arms, articulated fingers, and clean camera takes for video motion transfer.

## Play

Open https://sjefvanleeuwen.github.io/ai-hint-piano/, select a `.mid` or `.midi` file and press **Play**. The original demo works immediately. Audio uses the Salamander sampled piano; the first audible play loads the samples. Files are parsed locally and never uploaded.

## Prepare a Kling reference

1. Start with **Kling · steady three-quarter**. The head, torso, arms, hands, and keyboard are visible. **Front / both hands** and **Side / posture** offer alternative fixed compositions.
2. Inspect the performance with **Overhead** or **Key detail** before recording. Drag to adjust any composition, or choose a preset again to reset it.
3. Choose a 5–30 second take and press **Record 1080p reference**. Recording uses the current playback position, forces 1× speed, freezes camera movement, and captures only the scene at 1920 × 1080 and 30 fps, with audio if enabled. Stop early with the same button. Rendering/encoding performance depends on the device.
4. Use **Save matching frame** for a clean 1920 × 1080 PNG at the current pose and angle. It can guide creation of a matching appearance image with the same composition.
5. Browser recording prefers MP4 (H.264/AAC where supported). It checks native encoder capabilities and falls back to WebM if MP4 cannot be recorded. The button and capture status show the selected format, and downloaded files use the actual container extension. If WebM is saved and your Kling upload requires MP4, convert it while preserving frame timing. Keep each reference clip a single shot; use the same framing in the appearance image.

**Hide overlays** is also available for external screen recording. The follow camera and cinematic orbit are intended for viewing; the fixed presets are preferable for transfer. Selecting a preset restores automatic motion after manual orbiting.

## Motion and limitations

- Spatially ordered finger assignments consider held notes, recent fingering, chord spacing, black keys, and upcoming notes. Each hand has five fingers; pitches below MIDI 66 go to the left hand, the rest to the right.
- Finger joints form curved phalanges. Active fingertips land on the actual key surface, including black-key height and pressed-key travel. Preparatory motion, release, smoothed wrists, elbow IK, and torso lean improve readability.
- MIDI does not contain fingering. This is an estimated performance, not a reconstruction of a pianist’s actual technique. Dense or unusually wide passages and hand crossings require inspection. Notes that cannot use an available finger remain audible and animate their key; the app flags the fingering limitation.
- The body is a procedural mannequin, intended as a motion guide rather than a photorealistic avatar. AI motion transfer still does not guarantee exact musical fingering.
- Format 0/1 MIDI, running status, repeated overlapping notes, global tempo changes, and SMPTE timing are supported. Percussion channel 10 is excluded. Sustain-pedal interpretation and format 2 asynchronous sequences are not implemented.
- Existing sampler-safe pitch names, invalid-pitch filtering, and overlapping-note release protection are preserved.

## Validation

Run `node --test tests/*.test.mjs` for held-chord fingering, keyboard extremes, repeated notes, arm reach, tempo-map timing, running status and malformed MIDI handling. The app uses browser ESM and has no build step.

## Audio attribution

Piano playback uses the Salamander Grand Piano sample set by Alexander Holm, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Samples are served by the Tone.js Salamander sample host. Tone.js is loaded from jsDelivr under its MIT license. Three.js and OrbitControls are also loaded from jsDelivr.

## Deployment

`.github/workflows/pages.yml` deploys the static app to GitHub Pages when `main` is updated.
