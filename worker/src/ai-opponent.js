// AI opponent move generator (Google Gemini 2.0 Flash via AI Studio).
//
// Strategy: prompt Gemini with the game state and constraints, parse a single
// word out of the response, validate it (real word + stem not in playedStems),
// retry up to 5 times. Falls back to a curated per-target word list if all
// retries fail.
//
// Requires GOOGLE_AI_KEY as a Worker secret.

import { stem } from "./stemmer.js";
import { isRealWord } from "./dictionary.js";

const LLM_MODEL = "gemini-2.0-flash";
const LLM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent`;

async function callGemini(env, systemPrompt, userMessage, temperature) {
  const apiKey = env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_KEY not configured");

  const res = await fetch(`${LLM_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { temperature, maxOutputTokens: 64, responseMimeType: "text/plain" }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

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
- After many rounds the obvious words may be banned. Reach for adjacent
  concepts: properties of YOUR_TARGET (colors, textures, sounds, materials),
  things found IN/AT YOUR_TARGET, scientific or poetic synonyms, or
  characteristic actions associated with YOUR_TARGET. Single common nouns
  or adjectives only.
`;

// Per-target fallback word lists. Each entry is 8-12 semantically-close
// nouns/adjectives picked so most rounds of a game can be played from this
// list alone if the LLM fails. Words are chosen with diverse stems so several
// can be exhausted before the AI is forced into generic territory.
const FALLBACKS = {
  // Nature & landscape
  ocean:   ["wave", "tide", "current", "reef", "lagoon", "deep", "shore", "salt", "marine", "kelp"],
  space:   ["comet", "galaxy", "orbit", "nebula", "void", "cosmos", "rocket", "asteroid", "stellar", "vacuum"],
  forest:  ["pine", "oak", "moss", "wolf", "owl", "fern", "grove", "thicket", "wildlife", "canopy"],
  desert:  ["dune", "cactus", "scorpion", "mirage", "oasis", "drought", "barren", "sandstorm", "camel", "arid"],
  mountain:["peak", "summit", "cliff", "boulder", "ridge", "alpine", "climb", "snowy", "rugged", "elevation"],
  valley:  ["meadow", "hollow", "creek", "pasture", "vineyard", "lowland", "village", "brook", "gentle", "fertile"],
  river:   ["stream", "current", "fish", "delta", "rapid", "bank", "trout", "ferry", "flowing", "estuary"],
  canyon:  ["gorge", "chasm", "ravine", "cliff", "crevice", "abyss", "echo", "carved", "vast", "rocky"],
  volcano: ["ash", "magma", "eruption", "crater", "molten", "smoke", "caldera", "sulfur", "explosive", "fiery"],
  glacier: ["frost", "iceberg", "polar", "freeze", "arctic", "crevasse", "sheet", "calving", "frigid", "blue"],
  jungle:  ["vine", "parrot", "humid", "monkey", "fern", "canopy", "wild", "thick", "tropical", "tiger"],
  tundra:  ["frozen", "barren", "moss", "caribou", "wind", "polar", "permafrost", "lichen", "bleak", "icy"],
  meadow:  ["wildflower", "grass", "butterfly", "lush", "pasture", "bee", "clover", "open", "gentle", "fawn"],
  swamp:   ["bog", "alligator", "murky", "marsh", "moss", "frog", "humid", "stagnant", "willow", "mosquito"],
  // Sky & cosmos
  sun:     ["ray", "warmth", "noon", "yellow", "glare", "solar", "shine", "blaze", "daylight", "scorch"],
  moon:    ["crescent", "lunar", "silver", "tide", "phase", "halo", "midnight", "shadow", "orbit", "pale"],
  dawn:    ["sunrise", "early", "morning", "rooster", "dew", "rosy", "horizon", "awakening", "fresh", "amber"],
  dusk:    ["sunset", "evening", "owl", "purple", "shadow", "lantern", "golden", "fading", "horizon", "calm"],
  comet:   ["tail", "icy", "orbit", "streak", "blaze", "shooting", "rare", "frozen", "celestial", "elliptical"],
  planet:  ["orbit", "rocky", "gravity", "ring", "moon", "sphere", "satellite", "celestial", "rotation", "alien"],
  star:    ["twinkle", "bright", "distant", "nova", "shine", "celestial", "supernova", "constellation", "burning", "remote"],
  cloud:   ["fluffy", "mist", "fog", "rainstorm", "wisp", "overcast", "drizzle", "puffy", "shadow", "thunderhead"],
  // Elements
  fire:    ["flame", "ember", "blaze", "smoke", "ash", "torch", "burning", "spark", "hearth", "inferno"],
  water:   ["rain", "drop", "stream", "splash", "wet", "wave", "puddle", "liquid", "swim", "thirst"],
  earth:   ["soil", "dirt", "ground", "clay", "rock", "field", "garden", "loam", "worm", "harvest"],
  air:     ["breeze", "wind", "breath", "sky", "drift", "gust", "kite", "balloon", "flying", "fresh"],
  ice:     ["frost", "freeze", "cold", "crystal", "snowflake", "icicle", "glacier", "winter", "slippery", "frigid"],
  steam:   ["vapor", "boil", "kettle", "fog", "humidity", "hot", "engine", "sauna", "puff", "evaporate"],
  // Animals
  wolf:    ["howl", "pack", "fang", "prowl", "forest", "alpha", "shadow", "moon", "hunt", "den"],
  whale:   ["pod", "blue", "fluke", "blow", "deep", "krill", "harpoon", "sonar", "majestic", "song"],
  eagle:   ["talon", "soar", "feather", "beak", "nest", "mountain", "majestic", "swoop", "freedom", "predator"],
  snake:   ["slither", "scale", "venom", "coil", "hiss", "serpent", "fang", "rattle", "shed", "viper"],
  tiger:   ["stripe", "prowl", "jungle", "fang", "orange", "fierce", "hunter", "cub", "roar", "stealth"],
  dolphin: ["pod", "leap", "intelligent", "blowhole", "playful", "marine", "echolocation", "fin", "swift", "friendly"],
  lion:    ["mane", "pride", "roar", "savanna", "fierce", "king", "cub", "hunter", "golden", "majestic"],
  shark:   ["fin", "predator", "jaw", "tooth", "deep", "hunter", "great", "fearsome", "swim", "tail"],
  // Time & seasons
  spring:  ["bloom", "tulip", "rain", "fresh", "renewal", "pollen", "warmth", "thaw", "rebirth", "lamb"],
  autumn:  ["leaf", "harvest", "amber", "crisp", "pumpkin", "rake", "frost", "orange", "shorter", "migration"],
  summer:  ["sun", "vacation", "beach", "warm", "ice cream", "swim", "longer", "barbecue", "shorts", "humid"],
  winter:  ["snow", "frost", "cold", "sweater", "hibernate", "icicle", "bare", "shiver", "fireplace", "blizzard"],
  // Emotions
  joy:     ["laughter", "smile", "delight", "celebration", "bliss", "happy", "cheer", "elation", "warmth", "gratitude"],
  sorrow:  ["tear", "grief", "ache", "mourn", "loss", "weep", "blue", "heavy", "lonely", "regret"],
  anger:   ["rage", "fury", "shout", "burn", "fist", "wrath", "scowl", "boil", "heated", "outburst"],
  calm:    ["serene", "peaceful", "tranquil", "still", "gentle", "meditate", "quiet", "soothing", "restful", "balance"],
  // Architecture
  castle:  ["tower", "moat", "knight", "throne", "fortress", "drawbridge", "royal", "medieval", "rampart", "stone"],
  cottage: ["cozy", "thatched", "rustic", "garden", "chimney", "humble", "quaint", "rural", "fireplace", "ivy"],
  // Food
  bread:   ["loaf", "crumb", "yeast", "bakery", "wheat", "toast", "crust", "sandwich", "warm", "knead"],
  sushi:   ["roll", "rice", "wasabi", "japanese", "raw", "salmon", "soy", "chopstick", "nori", "sashimi"],
  coffee:  ["espresso", "bean", "brew", "mug", "morning", "caffeine", "roast", "latte", "bitter", "aroma"],
  tea:     ["leaf", "kettle", "herbal", "chamomile", "afternoon", "steep", "porcelain", "cozy", "soothing", "green"]
};

function pickFallback(target, forbiddenStems) {
  const list = FALLBACKS[target.toLowerCase()] || [];
  for (const w of list) {
    if (!forbiddenStems.includes(stem(w))) return w;
  }
  // Last resort — generic broad words. These are weak (low pull) so we
  // really do try the per-target list first.
  const generic = ["thing", "place", "kind", "form", "shape", "matter", "object", "nature"];
  for (const w of generic) if (!forbiddenStems.includes(stem(w))) return w;
  return "stuff";
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

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const userMsg = attempt === 0
        ? "What word do you play this turn?"
        : `Your previous answer was rejected (either a forbidden stem or not a real word). Try a different word — think of an adjacent concept related to "${aiTarget}" that hasn't been used yet.`;
      const raw = await callGemini(env, prompt, userMsg, 0.5 + attempt * 0.15);
      const word = extractWord(raw);
      if (!word) continue;
      if (playedStems.includes(stem(word))) continue;
      if (!(await isRealWord(word))) continue;
      return word;
    } catch (err) {
      console.error("Gemini error (attempt " + attempt + "):", err.message);
    }
  }

  return pickFallback(aiTarget, playedStems);
}
