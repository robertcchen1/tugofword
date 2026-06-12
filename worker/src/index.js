// Tug of Word — Cloudflare Worker entrypoint.
//
// Stateless HTTP API. Game state lives client-side and is sent with each
// request. This makes the Worker horizontally scalable and free to scale.
//
// Endpoints:
//   POST /api/new-game  { avoidPairs?: string[], customPair?: [string,string] }
//   POST /api/submit    { word, gameState }
//   POST /api/ai-move   { gameState }
//
// Multiplayer (future): swap /api/ai-move for a Durable-Object-backed
// WebSocket room without changing the rest of the surface.

import { stem } from "./stemmer.js";
import { isRealWord } from "./dictionary.js";
import { scorePull } from "./scoring.js";
import { PAIRS, pickPair } from "./targets.js";
import { thresholdFor, pitHalfWidthFor } from "./threshold.js";
import { generateAiMove } from "./ai-opponent.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

function makeInitialState(playerTarget, aiTarget) {
  const playedStems = [stem(playerTarget), stem(aiTarget)];
  return {
    playerTarget,
    aiTarget,
    round: 1,
    ropePos: 0,
    threshold: thresholdFor(1),
    pitHalfWidth: pitHalfWidthFor(1),
    playedStems,
    history: [] // [{ who: "player"|"ai", word, pull }]
  };
}

function applyMove(state, who, word, pull) {
  // `pull` is always from the global perspective:
  //   positive = toward player (left)
  //   negative = toward AI     (right)
  // So we add it directly regardless of who played the word.
  // A "bad" word by either player produces the appropriate-signed pull naturally.
  //
  // `who` is one of: "player" | "ai" (single-player mode)
  //                  "p1"     | "p2" (2-player local mode)
  // Round increments after the "right-side" player ("ai" or "p2") so a
  // full round always consists of both sides playing.
  const rightSidePlayer = (who === "ai" || who === "p2");
  const newState = {
    ...state,
    ropePos: Math.max(-1, Math.min(1, state.ropePos + pull)),
    round: state.round + (rightSidePlayer ? 1 : 0),
    playedStems: [...state.playedStems, stem(word)],
    history: [...state.history, { who, word, pull }]
  };
  newState.threshold = thresholdFor(newState.round);
  newState.pitHalfWidth = pitHalfWidthFor(newState.round);

  const t = newState.threshold;
  // Winner is named generically as "left" / "right" by which side of the
  // arena pulled the rope across the threshold. The client maps these
  // back to "player"/"ai" or "p1"/"p2" based on its mode for UI strings.
  if (newState.ropePos >= t) {
    return { ...newState, gameOver: true, winner: "left" };
  }
  if (newState.ropePos <= -t) {
    return { ...newState, gameOver: true, winner: "right" };
  }
  return newState;
}

async function handleNewGame(body) {
  const { avoidPairs = [], customPair } = body;

  if (customPair) {
    if (!Array.isArray(customPair) || customPair.length !== 2) {
      return json({ error: "customPair must be a [string, string] array" }, 400);
    }
    const [p, a] = customPair.map(w => String(w || "").toLowerCase().trim());
    if (!p || !a) return json({ error: "Both target words required" }, 400);
    if (stem(p) === stem(a)) {
      return json({ error: "Targets share the same stem" }, 400);
    }
    const [okP, okA] = await Promise.all([isRealWord(p), isRealWord(a)]);
    if (!okP) return json({ error: `"${p}" isn't a recognised word` }, 400);
    if (!okA) return json({ error: `"${a}" isn't a recognised word` }, 400);
    return json(makeInitialState(p, a));
  }

  const avoidSet = new Set(avoidPairs);
  const [playerTarget, aiTarget] = pickPair(avoidSet);
  return json(makeInitialState(playerTarget, aiTarget));
}

async function handleSubmit(body, env) {
  const { word, gameState, role = "player", precomputedPull } = body;
  if (!word || !gameState) return json({ error: "word and gameState required" }, 400);
  // Accept the legacy "player" role plus "p1"/"p2" (2-player mode) and "ai"
  // (used when the client submits a pre-generated AI word from its buffer).
  const safeRole = ["player", "p1", "p2", "ai"].includes(role) ? role : "player";

  // A precomputedPull is supplied only for AI-prefetched words: those were
  // already generated + scored + real-word-checked at /api/ai-word time, so
  // we trust the pull and skip the (slow) dictionary + embedding calls here.
  // The stem-collision check below STILL runs, which catches the case where
  // the human has since played a word sharing that stem.
  const hasPrecomputed = typeof precomputedPull === "number" && isFinite(precomputedPull);

  const w = String(word).toLowerCase().trim();

  if (!/^[a-z]+$/.test(w) || w.length < 2) {
    return json({ valid: false, reason: "Letters only, 2+ characters." });
  }
  const wStem = stem(w);
  if (gameState.playedStems.includes(wStem)) {
    return json({ valid: false, reason: "That stem has already been played." });
  }
  if (!hasPrecomputed && !(await isRealWord(w))) {
    return json({ valid: false, reason: `"${w}" isn't a recognised word.` });
  }

  const pull = hasPrecomputed
    ? Math.max(-1, Math.min(1, precomputedPull))
    : await scorePull(w, gameState.playerTarget, gameState.aiTarget, env);
  const newGameState = applyMove(gameState, safeRole, w, pull);

  return json({
    valid: true,
    pull,
    newGameState,
    gameOver: !!newGameState.gameOver,
    winner: newGameState.winner
  });
}

// Prefetch endpoint: generate + score one AI word WITHOUT applying it to a
// game state. The client buffers these so the AI's turn resolves instantly
// (it then submits the word via /api/submit with role:"ai" + precomputedPull).
async function handleAiWord(body, env) {
  const { gameState } = body;
  if (!gameState) return json({ error: "gameState required" }, 400);

  const word = await generateAiMove(gameState, env);
  const pull = await scorePull(word, gameState.playerTarget, gameState.aiTarget, env);
  return json({ word, pull, stem: stem(word) });
}

async function handleAiMove(body, env) {
  const { gameState } = body;
  if (!gameState) return json({ error: "gameState required" }, 400);
  if (gameState.gameOver) {
    return json({ error: "Game is already over" }, 400);
  }

  const word = await generateAiMove(gameState, env);
  const pull = await scorePull(word, gameState.playerTarget, gameState.aiTarget, env);
  const newGameState = applyMove(gameState, "ai", word, pull);

  return json({
    word,
    pull,
    newGameState,
    gameOver: !!newGameState.gameOver,
    winner: newGameState.winner
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    try {
      switch (url.pathname) {
        case "/api/new-game": return await handleNewGame(body);
        case "/api/submit":   return await handleSubmit(body, env);
        case "/api/ai-move":  return await handleAiMove(body, env);
        case "/api/ai-word":  return await handleAiWord(body, env);
        default:              return json({ error: "Not found" }, 404);
      }
    } catch (err) {
      console.error("Handler error:", err);
      return json({ error: "Internal error", detail: String(err?.message || err) }, 500);
    }
  }
};
