import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/vision_bundle.mjs";

/* ------------------------------------------------------------------ *
 * Gaze Typer — blink to select rotating letters.
 * Runs fully in the browser. Designed for iPhone front camera (Safari).
 * ------------------------------------------------------------------ */

// Characters that rotate through the carousel.
const CHARS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "_", "⌫"]; // "_" = space, "⌫" = backspace
const RING_CIRC = 339.292; // 2 * PI * r (r = 54)

// Tunable settings (persisted to localStorage).
const settings = loadSettings();

// Runtime state
let faceLandmarker = null;
let video = null;
let running = false;        // detection loop active
let paused = false;         // user paused rotation
let idx = 0;                // current carousel index
let dwellStart = 0;         // timestamp current letter started showing
let lastVideoTime = -1;

// Blink edge-detection state
let eyesClosed = false;
let closedSince = 0;
let selectionArmed = true;  // must re-open eyes before another select

// DOM
const el = (id) => document.getElementById(id);
const startScreen = el("startScreen");
const typeScreen = el("typeScreen");
const startBtn = el("startBtn");
const output = el("output");
const currentLetter = el("currentLetter");
const ringProgress = el("ringProgress");
const carousel = el("carousel");
const statusText = el("statusText");
const faceDot = el("faceDot");
const eyeFill = el("eyeFill");
const blinkPulse = el("blinkPulse");

ringProgress.style.strokeDasharray = RING_CIRC;
ringProgress.style.strokeDashoffset = RING_CIRC;

/* ----------------------------- Settings ---------------------------- */
function loadSettings() {
  const d = { speed: 1.5, sens: 0.5, hold: 120, speak: false, mirror: true };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem("gazeTyper") || "{}") };
  } catch {
    return d;
  }
}
function saveSettings() {
  localStorage.setItem("gazeTyper", JSON.stringify(settings));
}

function wireSettings() {
  const speedRange = el("speedRange");
  const sensRange = el("sensRange");
  const holdRange = el("holdRange");
  const speakToggle = el("speakToggle");
  const mirrorToggle = el("mirrorToggle");

  speedRange.value = settings.speed;
  sensRange.value = settings.sens;
  holdRange.value = settings.hold;
  speakToggle.checked = settings.speak;
  mirrorToggle.checked = settings.mirror;
  el("speedLabel").textContent = settings.speed.toFixed(1) + "s";
  el("sensLabel").textContent = settings.sens.toFixed(2);
  el("holdLabel").textContent = settings.hold + "ms";

  speedRange.oninput = () => {
    settings.speed = parseFloat(speedRange.value);
    el("speedLabel").textContent = settings.speed.toFixed(1) + "s";
    saveSettings();
  };
  sensRange.oninput = () => {
    settings.sens = parseFloat(sensRange.value);
    el("sensLabel").textContent = settings.sens.toFixed(2);
    saveSettings();
  };
  holdRange.oninput = () => {
    settings.hold = parseInt(holdRange.value, 10);
    el("holdLabel").textContent = settings.hold + "ms";
    saveSettings();
  };
  speakToggle.onchange = () => { settings.speak = speakToggle.checked; saveSettings(); };
  mirrorToggle.onchange = () => {
    settings.mirror = mirrorToggle.checked;
    saveSettings();
    applyMirror();
  };

  el("settingsBtn").onclick = () => el("settings").classList.remove("hidden");
  el("closeSettings").onclick = () => el("settings").classList.add("hidden");
}

function applyMirror() {
  if (video) video.classList.toggle("no-mirror", !settings.mirror);
}

/* --------------------------- Carousel UI --------------------------- */
function buildCarousel() {
  carousel.innerHTML = "";
  // Show a small window of letters around the current index.
  for (let off = -2; off <= 2; off++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    carousel.appendChild(cell);
  }
  renderCarousel();
}

function label(ch) {
  if (ch === "_") return "␣";
  return ch;
}

function renderCarousel() {
  const cells = carousel.children;
  let c = 0;
  for (let off = -2; off <= 2; off++) {
    const i = (idx + off + CHARS.length) % CHARS.length;
    const cell = cells[c++];
    cell.textContent = label(CHARS[i]);
    cell.classList.toggle("active", off === 0);
    cell.classList.toggle("near", Math.abs(off) === 1);
  }
  currentLetter.textContent = label(CHARS[idx]);
}

/* --------------------------- Rotation loop ------------------------- */
function tickRotation(now) {
  if (paused) { dwellStart = now; return; }
  const dwell = settings.speed * 1000;
  const elapsed = now - dwellStart;
  const frac = Math.min(elapsed / dwell, 1);
  ringProgress.style.strokeDashoffset = RING_CIRC * (1 - frac);

  if (elapsed >= dwell) {
    idx = (idx + 1) % CHARS.length;
    dwellStart = now;
    renderCarousel();
    ringProgress.style.strokeDashoffset = RING_CIRC;
  }
}

/* --------------------------- Selection ----------------------------- */
function selectCurrent() {
  const ch = CHARS[idx];
  if (ch === "⌫") {
    output.textContent = output.textContent.slice(0, -1);
  } else if (ch === "_") {
    output.textContent += " ";
    speak("space");
  } else {
    output.textContent += ch;
    speak(ch);
  }
  // Visual + restart dwell on current letter so the user can repeat it.
  blinkPulse.classList.remove("show");
  void blinkPulse.offsetWidth; // reflow to retrigger animation
  blinkPulse.classList.add("show");
  if (navigator.vibrate) navigator.vibrate(40);
  dwellStart = performance.now();
}

function speak(text) {
  if (!settings.speak || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* --------------------------- Blink logic --------------------------- */
// Given left/right blink scores (0..1), update meter and detect a deliberate blink.
function handleBlink(blinkScore, now) {
  eyeFill.style.width = Math.round(blinkScore * 100) + "%";

  const closed = blinkScore >= settings.sens;

  if (closed && !eyesClosed) {
    eyesClosed = true;
    closedSince = now;
  } else if (!closed && eyesClosed) {
    eyesClosed = false;
    selectionArmed = true; // eyes opened — ready for next blink
  }

  if (eyesClosed && selectionArmed && now - closedSince >= settings.hold) {
    selectionArmed = false; // consume this blink
    if (!paused) selectCurrent();
  }
}

/* --------------------------- Detection loop ------------------------ */
function loop() {
  if (!running) return;
  const now = performance.now();

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    let result = null;
    try {
      result = faceLandmarker.detectForVideo(video, now);
    } catch (e) {
      // transient decode errors on iOS — skip this frame
    }

    const shapes = result?.faceBlendshapes?.[0]?.categories;
    if (shapes) {
      faceDot.className = "dot dot-on";
      statusText.textContent = paused ? "Paused" : "Tracking — blink to select";
      const left = shapes.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
      const right = shapes.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
      handleBlink((left + right) / 2, now);
    } else {
      faceDot.className = "dot dot-off";
      statusText.textContent = "No face detected — center your face in the camera";
      eyeFill.style.width = "0%";
    }
  }

  tickRotation(now);
  requestAnimationFrame(loop);
}

/* --------------------------- Camera + model ------------------------ */
async function createLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
  );
  const baseOptions = {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  };
  const common = {
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1,
  };
  // iOS Safari is happier on CPU for the WASM build; try GPU then fall back.
  try {
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { ...baseOptions, delegate: "GPU" },
      ...common,
    });
  } catch (e) {
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { ...baseOptions, delegate: "CPU" },
      ...common,
    });
  }
}

async function startCamera() {
  video = el("video");
  applyMirror();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play(); // iOS needs an explicit play() inside the gesture
}

async function start() {
  startBtn.disabled = true;
  startBtn.textContent = "Starting…";
  try {
    startScreen.classList.add("hidden");
    typeScreen.classList.remove("hidden");
    statusText.textContent = "Loading face model…";

    await startCamera();
    faceLandmarker = await createLandmarker();

    // Prime speech synthesis within the user gesture (iOS requirement).
    if (window.speechSynthesis) {
      const warm = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(warm);
    }

    buildCarousel();
    dwellStart = performance.now();
    running = true;
    statusText.textContent = "Ready — look at the screen and blink";
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    statusText.textContent = "";
    typeScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    startBtn.disabled = false;
    startBtn.textContent = "Start Camera";
    alert(
      "Could not start the camera or face model.\n\n" +
        "• Make sure you allowed camera access.\n" +
        "• The page must be served over HTTPS.\n" +
        "• On iPhone, use Safari.\n\n" +
        (err && err.message ? "Details: " + err.message : "")
    );
  }
}

/* --------------------------- Controls ------------------------------ */
function wireControls() {
  startBtn.onclick = start;
  el("pauseBtn").onclick = () => {
    paused = !paused;
    el("pauseBtn").textContent = paused ? "Resume" : "Pause";
    dwellStart = performance.now();
  };
  el("clearBtn").onclick = () => { output.textContent = ""; };
  el("speakBtn").onclick = () => {
    const text = output.textContent.trim();
    if (text && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  };
}

wireSettings();
wireControls();
