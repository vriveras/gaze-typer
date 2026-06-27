/* ------------------------------------------------------------------ *
 * Flash Cards — tap-to-type scanning keyboard.
 * Letters flash one at a time (read aloud), tap anywhere to select.
 * No camera or ML needed; pairs with the blink typer (index.html).
 * ------------------------------------------------------------------ */

const CHARS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "_", "⌫"]; // "_" = space, "⌫" = backspace

const settings = loadSettings();

let idx = 0;
let paused = false;
let timer = null;

const el = (id) => document.getElementById(id);
const startScreen = el("startScreen");
const typeScreen = el("typeScreen");
const output = el("output");
const currentLetter = el("currentLetter");
const blinkPulse = el("blinkPulse");
const card = el("card");

/* ----------------------------- Settings ---------------------------- */
function loadSettings() {
  const d = { speed: 5, announce: true, speak: true };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem("gazeTyperFlash") || "{}") };
  } catch {
    return d;
  }
}
function saveSettings() {
  localStorage.setItem("gazeTyperFlash", JSON.stringify(settings));
}

function wireSettings() {
  const speedRange = el("speedRange");
  const announceToggle = el("announceToggle");
  const speakToggle = el("speakToggle");

  speedRange.value = settings.speed;
  announceToggle.checked = settings.announce;
  speakToggle.checked = settings.speak;
  el("speedLabel").textContent = settings.speed.toFixed(1) + "s";

  speedRange.oninput = () => {
    settings.speed = parseFloat(speedRange.value);
    el("speedLabel").textContent = settings.speed.toFixed(1) + "s";
    saveSettings();
    if (!paused) armTimer(); // apply new speed immediately
  };
  announceToggle.onchange = () => { settings.announce = announceToggle.checked; saveSettings(); };
  speakToggle.onchange = () => { settings.speak = speakToggle.checked; saveSettings(); };

  el("settingsBtn").onclick = () => el("settings").classList.remove("hidden");
  el("closeSettings").onclick = () => el("settings").classList.add("hidden");
}

/* --------------------------- Display ------------------------------- */
function label(ch) {
  return ch === "_" ? "␣" : ch;
}
function spoken(ch) {
  if (ch === "_") return "space";
  if (ch === "⌫") return "delete";
  return ch;
}

function showCurrent() {
  currentLetter.textContent = label(CHARS[idx]);
  if (settings.announce) speak(spoken(CHARS[idx]));
}

/* --------------------------- Flashing loop ------------------------- */
function advance() {
  idx = (idx + 1) % CHARS.length;
  showCurrent();
}

// (Re)start just the auto-advance timer, without re-announcing the letter.
function armTimer() {
  stopFlashing();
  timer = setInterval(advance, settings.speed * 1000);
}
function startFlashing() {
  showCurrent();
  armTimer();
}
function stopFlashing() {
  if (timer) { clearInterval(timer); timer = null; }
}

// "Next" button: jump to the next letter now and reset the dwell window.
function manualNext() {
  advance();
  if (!paused) armTimer();
}

/* --------------------------- Selection ----------------------------- */
function selectCurrent() {
  const ch = CHARS[idx];
  if (ch === "⌫") {
    output.textContent = output.textContent.slice(0, -1);
  } else if (ch === "_") {
    output.textContent += " ";
    if (settings.speak) speak("space");
  } else {
    output.textContent += ch;
    if (settings.speak) speak(ch);
  }

  blinkPulse.classList.remove("show");
  void blinkPulse.offsetWidth; // reflow to retrigger animation
  blinkPulse.classList.add("show");
  if (navigator.vibrate) navigator.vibrate(40);

  // Restart the dwell so the user has a fresh full interval to pick the next.
  if (!paused) armTimer();
}

/* --------------------------- Speech -------------------------------- */
function speak(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* --------------------------- Controls ------------------------------ */
function start() {
  startScreen.classList.add("hidden");
  typeScreen.classList.remove("hidden");
  // Prime speech within the user gesture (iOS requirement).
  if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  idx = 0;
  startFlashing();
}

function wireControls() {
  el("startBtn").onclick = start;

  // Tap the big card to select the current letter.
  card.addEventListener("click", () => { if (!paused) selectCurrent(); });

  el("nextBtn").onclick = manualNext;

  el("pauseBtn").onclick = () => {
    paused = !paused;
    el("pauseBtn").textContent = paused ? "Resume" : "Pause";
    if (paused) stopFlashing();
    else startFlashing();
  };
  el("clearBtn").onclick = () => { output.textContent = ""; };
  el("speakBtn").onclick = () => {
    const text = output.textContent.trim();
    if (text) speak(text);
  };
}

wireSettings();
wireControls();
