// Semantic-differential scoring via Cloudflare Workers AI embeddings.
//
// scorePull(input, playerTarget, aiTarget, env) -> number in roughly [-1, +1]
//   positive => pulls rope toward player
//   negative => pulls rope toward AI

const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";

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
  const res = await env.AI.run(EMBED_MODEL, { text: texts });
  // Workers AI returns { shape: [...], data: [[...], [...], ...] }
  return res.data;
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
