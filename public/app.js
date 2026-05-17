// Tug of Word — frontend game loop.

import { playPositive, playNegative, playWin, playLose } from "./sounds.js";

// =========================================================
// Config
// =========================================================
const API_KEY_STORAGE = "tugofword:apiEndpoint";
const SEEN_KEY        = "tugofword:seenPairs";
const TOTAL_PAIRS     = 100;

function apiBase() {
  const saved = localStorage.getItem(API_KEY_STORAGE);
  if (saved) return saved;
  // Dev convenience: if served on a localhost port that isn't the Worker's,
  // default to the standard wrangler dev port. Avoids the "404 on /api/..."
  // gotcha where the static-file server is on :3000 and the Worker on :8787.
  const { hostname, port } = location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocal && port !== "8787") return "http://127.0.0.1:8787";
  return ""; // same origin
}

async function api(path, body) {
  const base = apiBase();
  let r;
  try {
    r = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
  } catch (e) {
    throw new Error(`Cannot reach API at ${base || location.origin}. Is the Worker running? (Settings → API endpoint)`);
  }
  let data;
  try { data = await r.json(); }
  catch {
    if (r.status === 404) {
      throw new Error(`404 from ${base || location.origin}${path}. The frontend is talking to the wrong server — set API endpoint in Settings.`);
    }
    throw new Error(`Bad response (${r.status})`);
  }
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

// =========================================================
// Seen pairs (localStorage)
// =========================================================
function loadSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); }
  catch { return []; }
}
function saveSeen(arr) { localStorage.setItem(SEEN_KEY, JSON.stringify(arr)); }
function rememberPair(p, a) {
  const seen = loadSeen();
  seen.push(`${p}|${a}`);
  if (seen.length >= TOTAL_PAIRS) {
    saveSeen([]);
    toast("All 100 pairs seen — resetting!");
  } else {
    saveSeen(seen);
  }
  updateSeenCount();
}
function updateSeenCount() {
  const el = document.getElementById("seen-count");
  if (el) el.textContent = loadSeen().length;
}

// =========================================================
// Toast
// =========================================================
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

// =========================================================
// Tabs
// =========================================================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.id === `tab-${target}`));
  });
});

// =========================================================
// Render
// =========================================================
let state = null;

// Visual geometry (must match index.html SVG anchor positions)
const CAT_BLACK_CENTER  = 300;  // viewBox x of black-cat center at rest
const CAT_ORANGE_CENTER = 700;  // viewBox x of orange-cat center at rest
const PIT_CENTER        = 500;
const CAT_DIST_TO_PIT   = CAT_ORANGE_CENTER - PIT_CENTER; // 200, symmetric

function renderState(s) {
  state = s;
  document.getElementById("player-target").textContent = s.playerTarget;
  document.getElementById("ai-target").textContent     = s.aiTarget;
  document.getElementById("round").textContent          = s.round;

  const arena = document.getElementById("arena");
  arena.style.setProperty("--rope-pos", s.ropePos);

  // ---- Pit width ----
  // pitHalfWidth from backend is a fraction of TOTAL arena (0.04..0.18 typical).
  // In viewBox: pitRx = pitHalfWidth * 1000 → pit spans (500 - pitRx)..(500 + pitRx).
  const pitRx = s.pitHalfWidth * 1000;
  arena.querySelector(".pit").setAttribute("rx", pitRx);
  arena.querySelector(".pit-inner").setAttribute("rx", Math.max(0, pitRx - 4));

  // ---- Cat positions (SVG transform attribute, in viewBox units) ----
  // Goal: when |ropePos| = threshold (game ends), the LOSING cat's center
  // lands exactly at the pit edge — so the fall is triggered right when
  // the pit visually "reaches under" the cat.
  //
  // distToPitEdge = CAT_DIST_TO_PIT - pitRx  (room for the cat to slide
  //                                            before reaching pit edge)
  // leanFrac = ropePos / threshold (clamped ±1 — should always be inside
  //                                  for an in-play state)
  // shift = -leanFrac * distToPitEdge
  //   (positive ropePos → negative shift → both cats slide LEFT, orange
  //    toward pit on its left, black bracing back further left)
  const distToPitEdge = Math.max(0, CAT_DIST_TO_PIT - pitRx);
  const leanFrac = Math.max(-1, Math.min(1, s.ropePos / Math.max(0.01, s.threshold)));
  const shift = -leanFrac * distToPitEdge;
  arena.querySelector(".cat-black-pos").setAttribute("transform", `translate(${shift} 0)`);
  arena.querySelector(".cat-orange-pos").setAttribute("transform", `translate(${shift} 0)`);
  // Rope shifts the same amount so it stays connected to both cats' paws.
  arena.querySelector(".rope-wrap").setAttribute("transform", `translate(${shift} 0)`);

  // ---- Imbalance readout ----
  const imb = document.getElementById("imbalance-text");
  const val = s.ropePos;
  imb.textContent = (val >= 0 ? "+" : "") + val.toFixed(3);
  imb.classList.toggle("positive", val > 0.02);
  imb.classList.toggle("negative", val < -0.02);

  // ---- Sudden death styling ----
  const isSuddenDeath = s.round > 5;
  document.body.classList.toggle("sudden-death", isSuddenDeath);
  document.getElementById("sudden-death-badge").hidden = !isSuddenDeath;
}

function renderMove(who, word, pull) {
  const list = document.getElementById("history");
  const li = document.createElement("li");
  li.className = who;
  const pullCls = pull > 0 ? "pull-pos" : "pull-neg";
  const sign    = pull > 0 ? "+" : "";
  const who_    = who === "player" ? "You" : "AI";
  li.innerHTML = `<span><strong>${who_}:</strong> ${escapeHtml(word)}</span>
                  <span class="${pullCls}">${sign}${pull.toFixed(3)}</span>`;
  list.prepend(li);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

function feedback(msg, kind = "") {
  const el = document.getElementById("feedback");
  el.textContent = msg;
  el.className = "feedback " + kind;
}

function pulseCats(pull) {
  // pull > 0: black cat braces (winning), orange cat shudders (losing).
  const black  = document.querySelector(".cat-black-wrap");
  const orange = document.querySelector(".cat-orange-wrap");
  const winning = pull > 0 ? black : orange;
  const losing  = pull > 0 ? orange : black;
  winning.classList.add("bracing");
  losing.classList.add("pulled");
  setTimeout(() => {
    winning.classList.remove("bracing");
    losing.classList.remove("pulled");
  }, 650);
}

// =========================================================
// Game flow
// =========================================================
async function newGame({ customPair } = {}) {
  setInputDisabled(true);
  feedback("");
  try {
    const body = customPair
      ? { customPair }
      : { avoidPairs: loadSeen() };
    const s = await api("/api/new-game", body);
    document.getElementById("history").innerHTML = "";
    document.getElementById("game-over").hidden = true;
    document.querySelector(".cat-black-pos").classList.remove("falling");
    document.querySelector(".cat-orange-pos").classList.remove("falling");
    document.querySelector(".cat-black-wrap").classList.remove("cheering");
    document.querySelector(".cat-orange-wrap").classList.remove("cheering");
    renderState(s);
    rememberPair(s.playerTarget, s.aiTarget);
    setInputDisabled(false);
    document.getElementById("word-input").focus();
  } catch (err) {
    feedback(err.message, "error");
    setInputDisabled(false);
  }
}

function setInputDisabled(disabled) {
  document.getElementById("word-input").disabled  = disabled;
  document.getElementById("submit-btn").disabled  = disabled;
  document.getElementById("new-pair-btn").disabled = disabled;
}

async function submitWord(word) {
  setInputDisabled(true);
  feedback("Scoring…");
  try {
    const res = await api("/api/submit", { word, gameState: state });
    if (!res.valid) {
      feedback(res.reason, "error");
      playNegative();
      setInputDisabled(false);
      document.getElementById("word-input").select();
      return;
    }

    // Player's pull
    renderState(res.newGameState);
    renderMove("player", word, res.pull);
    pulseCats(res.pull);
    res.pull > 0 ? playPositive() : playNegative();
    feedback(`You pulled ${res.pull > 0 ? "+" : ""}${res.pull.toFixed(3)}`,
             res.pull > 0 ? "positive" : "negative");

    if (res.gameOver) return endGame(res.winner);

    // AI turn
    await new Promise(r => setTimeout(r, 850));
    feedback("AI thinking…");
    const aiRes = await api("/api/ai-move", { gameState: res.newGameState });
    renderState(aiRes.newGameState);
    renderMove("ai", aiRes.word, aiRes.pull);
    // From AI's perspective the pull is negative for player; positive feedback for AI = negative pull
    pulseCats(aiRes.pull);
    aiRes.pull < 0 ? playPositive() : playNegative();
    feedback(`AI played "${aiRes.word}" (${aiRes.pull > 0 ? "+" : ""}${aiRes.pull.toFixed(3)})`,
             aiRes.pull < 0 ? "negative" : "positive");

    if (aiRes.gameOver) return endGame(aiRes.winner);

    setInputDisabled(false);
    document.getElementById("word-input").value = "";
    document.getElementById("word-input").focus();
  } catch (err) {
    feedback(err.message, "error");
    setInputDisabled(false);
  }
}

function endGame(winner) {
  const playerWon = winner === "player";
  const blackWrap  = document.querySelector(".cat-black-wrap");
  const orangeWrap = document.querySelector(".cat-orange-wrap");
  const blackPos   = document.querySelector(".cat-black-pos");
  const orangePos  = document.querySelector(".cat-orange-pos");
  if (playerWon) {
    orangePos.classList.add("falling");
    blackWrap.classList.add("cheering");
    playWin();
  } else {
    blackPos.classList.add("falling");
    orangeWrap.classList.add("cheering");
    playLose();
  }

  setTimeout(() => {
    document.getElementById("game-over-title").textContent =
      playerWon ? "🎉 You win!" : "😿 The orange cat wins!";
    document.getElementById("game-over-subtitle").textContent =
      playerWon
        ? `Your "${state.playerTarget}" cat pulled the orange cat into the pit.`
        : `Your "${state.playerTarget}" cat fell in — the AI's "${state.aiTarget}" was stronger.`;
    document.getElementById("game-over").hidden = false;
  }, 1200);
}

// =========================================================
// Wiring
// =========================================================
document.getElementById("submit-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("word-input");
  const word = input.value.trim();
  if (!word) return;
  submitWord(word);
});

document.getElementById("new-pair-btn").addEventListener("click", () => newGame());

document.getElementById("play-again-btn").addEventListener("click", () => {
  if (!state) return newGame();
  newGame({ customPair: [state.playerTarget, state.aiTarget] });
});
document.getElementById("new-pair-after-btn").addEventListener("click", () => newGame());

document.getElementById("custom-pair-form").addEventListener("submit", e => {
  e.preventDefault();
  const p = document.getElementById("custom-player").value.trim();
  const a = document.getElementById("custom-ai").value.trim();
  if (!p || !a) return;
  // Switch to game tab
  document.querySelector('.tab-btn[data-tab="game"]').click();
  newGame({ customPair: [p, a] });
});

document.getElementById("reset-seen").addEventListener("click", () => {
  saveSeen([]);
  updateSeenCount();
  toast("Seen pairs cleared.");
});

document.getElementById("api-endpoint-form").addEventListener("submit", e => {
  e.preventDefault();
  const v = document.getElementById("api-endpoint").value.trim().replace(/\/$/, "");
  if (v) localStorage.setItem(API_KEY_STORAGE, v);
  else   localStorage.removeItem(API_KEY_STORAGE);
  toast(v ? `API: ${v}` : "API: same origin");
});

// Pre-populate settings inputs
document.getElementById("api-endpoint").value = localStorage.getItem(API_KEY_STORAGE) || "";

// =========================================================
// Load SVG sprite sheet then start
// =========================================================
(async function init() {
  try {
    const r = await fetch("img/cats.svg");
    const svg = await r.text();
    document.getElementById("svg-sprites").innerHTML = svg;
  } catch {
    console.warn("Could not load cat sprites.");
  }
  updateSeenCount();
  await newGame();
})();
