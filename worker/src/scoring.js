// Semantic-differential scoring via Google AI text-embedding-004.
//
// scorePull(input, playerTarget, aiTarget, env) -> number in roughly [-1, +1]
//   positive => pulls rope toward player
//   negative => pulls rope toward AI
//
// Uses Google's batchEmbedContents endpoint for a single round-trip per turn.
// Requires GOOGLE_AI_KEY as a Worker secret (or in worker/.dev.vars for local).

const EMBED_MODEL = "text-embedding-004";
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`;

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function embed(env, texts) {
  const apiKey = env.GOOGLE_AI_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_AI_KEY is not configured. " +
      "For local dev: create worker/.dev.vars with GOOGLE_AI_KEY=... " +
      "For prod: run `npx wrangler secret put GOOGLE_AI_KEY`."
    );
  }

  const body = {
    requests: texts.map(text => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] }
    }))
  };

  const res = await fetch(`${EMBED_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google embed API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error(`Unexpected Google embed response: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.embeddings.map(e => e.values);
}

export async function scorePull(input, playerTarget, aiTarget, env) {
  const vecs = await embed(env, [input, playerTarget, aiTarget]);
  const [eIn, eP, eO] = vecs;
  const simP = cosineSim(eIn, eP);
  const simO = cosineSim(eIn, eO);
  // Differential. Amplify slightly so typical pulls land in the 0.05..0.4 range.
  const raw = simP - simO;
  return Math.max(-1, Math.min(1, raw * 1.5));
}
