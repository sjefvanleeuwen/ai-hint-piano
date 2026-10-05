# Keyframe — Piano Study

A browser-based Three.js visualization for studying MIDI piano performances. The keyboard, pressed key travel, simplified hands, and camera movement are designed to make performance motion clear as a reference for video and motion models.

## Use

Open the GitHub Pages site, choose a `.mid` or `.midi` file, and press **Play**. The built-in original demo works without uploading a file. The first play starts the browser audio engine and loads the piano samples. Use **Audio On/Off** to mute or restore playback. Select a camera path and playback speed; drag to orbit and scroll to zoom.

The MIDI is parsed locally in the browser. No file is uploaded.

## Audio attribution

Piano playback uses the Salamander Grand Piano sample set by Alexander Holm, licensed under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/). Samples are served by the Tone.js Salamander sample host. Tone.js is loaded from jsDelivr under its MIT license.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the static app when `main` is updated. In repository **Settings → Pages**, set the build and deployment source to **GitHub Actions** if it is not already configured.

## Technical notes

- Three.js and OrbitControls are loaded from jsDelivr.
- Tone.js Sampler plays the sampled piano voice in sync with MIDI note-on/note-off events.
- MIDI playback supports standard note-on/note-off events and tempo metadata.
- The built-in demo sequence is original and included as source data.
- Uploaded MIDI files are not redistributed or sent to a server.
