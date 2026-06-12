# 🐈‍⬛ Tug of Word 🐈

A turn-based semantic word game where you (the black cat) compete against an AI opponent (the orange cat) by submitting words. Your word's similarity to *your* target word — minus its similarity to the *opponent's* target — determines which way the rope is pulled. The losing cat falls into a pit in the center, which widens during sudden death.

## How to play

1. The game picks two categorically-related target words (e.g. **space** vs **ocean**).
2. You and the AI each submit one word per round.
3. Each word is embedded and scored: `similarity(word, your_target) − similarity(word, opponent_target)`.
4. Positive pulls move the rope toward you; negative toward the AI.
5. After round 5, **sudden death** begins — the pit widens each round so a smaller pull is enough to win.
6. Most games end by round 7–10. Don't let your cat fall in!

**Rules:** real English words only; no morphological duplicates (the Porter stemmer rejects "oceans" if "ocean" has been played).

## Architecture

```
public/         ← static frontend (deploy to Cloudflare Pages)
  index.html    — tabs (Game / How to Play / Settings) + game arena
  app.js        — game loop, fetch calls, localStorage pair tracking
  style.css     — cats, rope, pit, animations, mobile
  sounds.js     — Web Audio chimes
  img/          — SVG cats + favicon

worker/         ← Cloudflare Worker (deploy to workers.dev)
  src/
    index.js       — HTTP router
    stemmer.js     — Porter stemmer (pure JS, no deps)
    dictionary.js  — bundled common-word allowlist + dictionaryapi.dev fallback
    scoring.js     — cosine similarity via Workers AI embeddings (bge-base-en-v1.5)
    targets.js     — 100 curated target pairs across 10 themes
    threshold.js   — sudden-death curve
    ai-opponent.js — Gemma 3 move generator with retry + fallback
  wrangler.toml
```

### Why this stack?

- **Vanilla HTML/CSS/JS** — matches the other games in this workspace; no build step.
- **Cloudflare Worker** as the API host — free, fast cold starts, deploys in seconds.
- **Google AI Studio** for both the embedding model (`text-embedding-004`) and the AI opponent LLM (`gemini-2.0-flash`). Free tier covers ~1,500 requests/day for each — plenty for casual play. (We previously used Cloudflare Workers AI but its 10k-neurons/day free limit was tight.)
- **Stateless Worker** — game state is held client-side and sent with each request. Trivially horizontal-scaling.
- **Multiplayer-ready** — the only place "opponent's word" comes from is `POST /api/ai-move`. Swapping that for a Durable-Object-backed WebSocket room is an additive change.

## Development

You'll need:
- [Node.js](https://nodejs.org/)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free plan)
- A [Google AI Studio API key](https://aistudio.google.com/apikey) (free)

```bash
# Install wrangler
npm install

# Authenticate with Cloudflare (one-time)
npx wrangler login

# Put your Google AI key in a local .dev.vars file (NOT committed)
echo "GOOGLE_AI_KEY=YOUR_KEY_HERE" > worker/.dev.vars

# Run the Worker locally (http://localhost:8787)
npm run dev

# In a second terminal, serve the frontend locally (http://localhost:3000)
npm run serve:web

# Open http://localhost:3000 — the frontend auto-targets the Worker at :8787.
```

## Deploy

```bash
# Upload your Google AI key as a Worker secret (one-time)
npx wrangler secret put GOOGLE_AI_KEY --config worker/wrangler.toml
# (paste your key when prompted)

# Deploy the Worker
npm run deploy:worker

# Deploy the frontend to Cloudflare Pages
npm run deploy:pages
```

After both deploy, set the frontend's API endpoint (in the Settings tab) to your Worker's URL (e.g. `https://tugofword-api.<your-subdomain>.workers.dev`) — or put them on the same domain via a Pages function route.

## API

| Endpoint | Body | Returns |
|---|---|---|
| `POST /api/new-game` | `{ avoidPairs?: string[], customPair?: [string, string] }` | initial game state |
| `POST /api/submit` | `{ word, gameState }` | `{ valid, reason?, pull?, newGameState, gameOver?, winner? }` |
| `POST /api/ai-move` | `{ gameState }` | `{ word, pull, newGameState, gameOver?, winner? }` |

## Customisation

- **More target pairs:** edit `worker/src/targets.js` and append to `PAIRS`.
- **Different cats:** swap the `<symbol>` contents in `public/img/cats.svg`. AI-image-gen prompts for higher-fidelity art are in the plan file.
- **Different LLM:** change `LLM_MODEL` in `worker/src/ai-opponent.js`.

## Status

- ✅ Single-player vs AI
- ✅ 100 target pairs + custom pair input
- ✅ Sudden death (widening pit)
- ⏳ Online multiplayer (architecture supports — not yet implemented)
- ⏳ Capacitor mobile wrap

## License

MIT
