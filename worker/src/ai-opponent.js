// AI opponent move generator (Gemma 3 via Workers AI).
//
// Strategy: prompt Gemma with the game state and constraints, parse a single
// word out of the response, validate it (real word + stem not in playedStems),
// retry up to 3 times. Falls back to a safe word if all retries fail.

import { stem } from "./stemmer.js";
import { isRealWord } from "./dictionary.js";

const LLM_MODEL = "@cf/google/gemma-3-12b-it";

const SYSTEM_PROMPT_TEMPLATE = ({ aiTarget, playerTarget, ropePos, threshold, round, playedStems }) => `
You are an AI opponent in "Tug of Word," a competitive semantic word game.

GAME RULES:
- Each turn you submit ONE English word.
- Your word's score = cosine_similarity(your_word, YOUR_TARGET)
                    - cosine_similarity(your_word, OPPONENT_TARGET).
- A more-NEGATIVE differential is better for you (it pulls the rope toward your side).
- Equivalently: pick words MORE similar to YOUR_TARGET than to OPPONENT_TARGET.
- The rope is at position ${ropePos.toFixed(3)} (range -${threshold.toFixed(2)}..+${threshold.toFixed(2)};
  positive = opponent's side; you win when rope reaches -${threshold.toFixed(2)}).
- Current round: ${round}. Win threshold: ${threshold.toFixed(2)}.
  (Threshold shrinks each round after round 5 — be aggressive late game.)

YOUR TARGET WORD: "${aiTarget}"
OPPONENT TARGET WORD: "${playerTarget}"

FORBIDDEN STEMS (do NOT submit any word whose Porter stem matches these):
${playedStems.length > 0 ? playedStems.join(", ") : "(none yet)"}

OUTPUT FORMAT:
Return exactly one JSON object: {"word": "<your_word>"}.
No prose, no explanation, no markdown, no code fences.

STRATEGY:
- Pick a word strongly associated with YOUR_TARGET but weakly associated with OPPONENT_TARGET.
- Avoid words whose stem appears in FORBIDDEN STEMS.
- In sudden death (round > 5), prefer high-conviction picks even if obvious.
`;

// Last-resort fallback words per target (broad nouns very close to common targets).
// Used only if 3 Gemma retries all fail validation.
const FALLBACKS = {
  ocean: "wave", space: "comet", forest: "pine", desert: "dune",
  mountain: "peak", valley: "hollow", river: "stream", canyon: "gorge",
  volcano: "ash", glacier: "frost", sun: "ray", moon: "crescent",
  dawn: "sunrise", dusk: "twilight", fire: "flame", water: "rain",
  earth: "soil", air: "breeze", ice: "frost", steam: "vapor"
};

function pickFallback(target, forbiddenStems) {
  const candidate = FALLBACKS[target.toLowerCase()];
  if (candidate && !forbiddenStems.includes(stem(candidate))) return candidate;
  // Last resort — a generic word
  const generic = ["thing", "place", "kind", "form", "shape"];
  for (const w of generic) if (!forbiddenStems.includes(stem(w))) return w;
  return "object";
}

function extractWord(raw) {
  if (!raw || typeof raw !== "string") return null;
  // Try JSON first
  const jsonMatch = raw.match(/\{[^{}]*"word"\s*:\s*"([a-zA-Z]+)"[^{}]*\}/);
  if (jsonMatch) return jsonMatch[1].toLowerCase();
  // Fall back to first standalone word
  const wordMatch = raw.match(/\b([a-zA-Z]{2,20})\b/);
  return wordMatch ? wordMatch[1].toLowerCase() : null;
}

export async function generateAiMove(gameState, env) {
  const { aiTarget, playerTarget, ropePos, threshold, round, playedStems } = gameState;
  const prompt = SYSTEM_PROMPT_TEMPLATE({
    aiTarget, playerTarget, ropePos, threshold, round, playedStems
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await env.AI.run(LLM_MODEL, {
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "What word do you play this turn?" }
        ],
        max_tokens: 32,
        temperature: 0.6 + attempt * 0.2 // bump temp on retry
      });
      const raw = res.response || res.result || "";
      const word = extractWord(raw);
      if (!word) continue;
      if (playedStems.includes(stem(word))) continue;
      if (!(await isRealWord(word))) continue;
      return word;
    } catch (err) {
      // Model error — try again or fall back
      console.error("Gemma error:", err);
    }
  }

  return pickFallback(aiTarget, playedStems);
}
