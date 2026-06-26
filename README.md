# Gaze Typer 👁️⌨️

A blink-to-type web app for hands-free communication. Letters rotate one at a
time on screen; when the letter you want appears, **blink** to select it. Built
for use on an **iPhone with the front-facing camera** in Safari.

Everything runs **on-device** in the browser using Google MediaPipe's
FaceLandmarker — no video ever leaves the phone, and no server is required.

## How it works

1. The front camera watches your face.
2. Letters (A–Z, space `␣`, and backspace `⌫`) cycle through a carousel, one
   highlighted at a time, on an adjustable timer.
3. A deliberate **blink** selects the currently highlighted letter.
4. The selected letters build up into a sentence you can have read aloud.

## Using it

1. Open the site **over HTTPS** on your iPhone in **Safari** (camera access is
   blocked on plain `http://`, except `localhost`).
2. Tap **Start Camera** and allow camera access when prompted.
3. Hold the phone so your face is centered and well lit. The status dot turns
   green when your face is tracked.
4. Watch the big letter in the ring. When the letter you want is shown, blink.

## Settings (⚙)

- **Rotation speed** — how long each letter is shown before advancing.
- **Blink sensitivity** — how firmly you must close your eyes to register a
  blink (lower = easier).
- **Blink hold** — how long the eyes must stay closed to count as a selection.
  Increase this to stop ordinary, involuntary blinks from selecting letters by
  accident.
- **Speak each letter** / **Speak** button — voice feedback via the browser's
  speech synthesis.
- **Mirror camera preview** — flip the self-view.

## Running locally

It's a static site — any HTTPS-capable static host works (GitHub Pages,
Netlify, Vercel, …). For local testing:

```bash
# Python
python3 -m http.server 8000
# then open http://localhost:8000  (localhost is allowed without HTTPS)
```

To test on the iPhone itself you need HTTPS (e.g. deploy to GitHub Pages, or use
a tunnel like `ngrok http 8000`).

### Deploy to GitHub Pages

Push these files and enable Pages for the repo (Settings → Pages → deploy from
branch). The app is then available at the Pages HTTPS URL, which iPhone Safari
will accept for camera access.

## Files

- `index.html` — markup and UI.
- `style.css` — styling.
- `app.js` — camera, MediaPipe face/blink detection, rotation and selection
  logic.

## Notes & tips

- First load downloads the face model (~3 MB) from a CDN, so the initial start
  takes a few seconds and needs an internet connection.
- Good, even lighting on the face dramatically improves blink detection.
- For users whose natural blinks would trigger selections, raise **Blink hold**
  (e.g. 250–400 ms) so only a deliberate, held blink counts.
