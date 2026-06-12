// 100 curated categorically-related target word pairs, organized by theme
// so the AI opponent can fall back to theme-adjacent words when needed.
//
// Format: each theme has a `pairs` array (the actual targets) and a `related`
// array (extra semantically-close words used as AI fallbacks).

export const THEMES = {
  "nature": {
    pairs: [
      ["space", "ocean"], ["forest", "desert"], ["mountain", "valley"],
      ["river", "canyon"], ["volcano", "glacier"], ["jungle", "tundra"],
      ["meadow", "swamp"], ["delta", "plateau"], ["cliff", "beach"],
      ["cave", "summit"]
    ],
    related: [
      "wilderness", "terrain", "landscape", "scenic", "rugged", "natural",
      "remote", "vista", "habitat", "wildlife", "ecosystem", "verdant",
      "barren", "lush", "pristine", "untamed"
    ]
  },
  "cosmos": {
    pairs: [
      ["sun", "moon"], ["thunderstorm", "rainbow"], ["comet", "planet"],
      ["lightning", "fog"], ["star", "cloud"], ["galaxy", "atmosphere"],
      ["eclipse", "aurora"], ["meteor", "satellite"], ["nebula", "horizon"],
      ["blizzard", "heatwave"]
    ],
    related: [
      "sky", "celestial", "cosmic", "stellar", "orbit", "luminous", "glow",
      "radiance", "halo", "infinite", "vast", "shimmer",
      "constellation", "zodiac", "ethereal", "interstellar",
      "storm", "thunder", "drizzle", "wind", "weather", "atmospheric",
      "downpour", "breezy", "cloudy"
    ]
  },
  "animals": {
    pairs: [
      ["wolf", "whale"], ["eagle", "snake"], ["tiger", "dolphin"],
      ["owl", "sparrow"], ["lion", "shark"], ["horse", "octopus"],
      ["bear", "rabbit"], ["hawk", "salmon"], ["fox", "turtle"],
      ["deer", "crab"]
    ],
    related: [
      "creature", "beast", "predator", "prey", "fur", "feather", "scale",
      "claw", "fang", "tail", "wild", "hunter", "pack", "herd", "den",
      "nest", "burrow", "instinct"
    ]
  },
  "elements": {
    pairs: [
      ["fire", "water"], ["earth", "air"], ["ice", "steam"],
      ["ember", "snowflake"], ["lava", "frost"], ["wood", "metal"],
      ["gravel", "crystal"], ["dust", "mud"], ["coal", "diamond"],
      ["clay", "glass"]
    ],
    related: [
      "matter", "substance", "particle", "element", "raw", "solid", "liquid",
      "molten", "crystal", "ore", "mineral", "grain", "vapor", "rust",
      "powder", "shard"
    ]
  },
  "time": {
    pairs: [
      ["spring", "autumn"], ["morning", "midnight"], ["past", "future"],
      ["summer", "winter"], ["weekday", "weekend"], ["yesterday", "tomorrow"],
      ["century", "moment"], ["ancient", "modern"], ["sunrise", "midnight"],
      ["youth", "elder"]
    ],
    related: [
      "season", "era", "epoch", "moment", "instant", "duration", "hour",
      "decade", "fleeting", "eternal", "forever", "brief", "lasting",
      "passing", "ageless", "vintage"
    ]
  },
  "emotions": {
    pairs: [
      ["joy", "sorrow"], ["anger", "calm"], ["fear", "courage"],
      ["love", "hatred"], ["hope", "despair"], ["pride", "shame"],
      ["excitement", "boredom"], ["wonder", "disgust"], ["envy", "gratitude"],
      ["serenity", "panic"]
    ],
    related: [
      "feeling", "mood", "passion", "heartfelt", "emotional", "tender",
      "intense", "raw", "vulnerable", "stirring", "moving", "heartbreak",
      "yearning", "longing", "bliss", "grief"
    ]
  },
  "architecture": {
    pairs: [
      ["castle", "cottage"], ["skyscraper", "cabin"], ["bridge", "tunnel"],
      ["temple", "factory"], ["palace", "hut"], ["library", "warehouse"],
      ["cathedral", "shed"], ["fortress", "tent"], ["mansion", "shack"],
      ["museum", "barn"]
    ],
    related: [
      "building", "structure", "edifice", "tower", "wall", "roof", "facade",
      "column", "arch", "dome", "foundation", "blueprint", "construction",
      "masonry", "rafter", "doorway"
    ]
  },
  "music_art": {
    pairs: [
      ["piano", "drum"], ["painting", "sculpture"], ["jazz", "symphony"],
      ["violin", "guitar"], ["opera", "ballet"], ["lullaby", "anthem"],
      ["sketch", "photograph"], ["flute", "trumpet"], ["choir", "soloist"],
      ["pottery", "tattoo"]
    ],
    related: [
      "melody", "rhythm", "harmony", "tempo", "note", "chord", "canvas",
      "brush", "palette", "gallery", "concert", "performance", "artistic",
      "composition", "tune", "verse"
    ]
  },
  "food": {
    pairs: [
      ["bread", "sushi"], ["taco", "ramen"], ["cake", "salad"],
      ["bacon", "tofu"], ["soup", "sandwich"], ["popcorn", "caviar"],
      ["lemon", "garlic"], ["cheese", "honey"], ["mushroom", "berry"],
      ["pancake", "omelette"]
    ],
    related: [
      "meal", "dish", "recipe", "kitchen", "cuisine", "flavor", "spice",
      "sweet", "savory", "fresh", "tasty", "delicious", "cooking", "baking",
      "ingredient", "appetite"
    ]
  },
  "abstract": {
    pairs: [
      ["order", "chaos"], ["dream", "reality"], ["silence", "noise"],
      ["truth", "fiction"], ["freedom", "duty"], ["light", "shadow"],
      ["wisdom", "innocence"], ["beginning", "ending"], ["question", "answer"],
      ["memory", "forgetting"]
    ],
    related: [
      "idea", "concept", "essence", "notion", "thought", "principle",
      "philosophy", "meaning", "spirit", "soul", "mystery", "secret",
      "knowledge", "belief", "perception", "consciousness"
    ]
  }
};

// Flat list of all pairs (preserves existing PAIRS API)
export const PAIRS = Object.values(THEMES).flatMap(t => t.pairs);

// Reverse lookup: target word → theme key. Used by the AI opponent to find
// fallback words within the same semantic category.
export const TARGET_TO_THEME = {};
for (const [themeKey, theme] of Object.entries(THEMES)) {
  for (const [a, b] of theme.pairs) {
    TARGET_TO_THEME[a] = themeKey;
    TARGET_TO_THEME[b] = themeKey;
  }
}

// Words in the same theme as `target`, EXCLUDING the target itself and its
// usual opponent (we don't want the AI to play words that would help its
// opponent). Returns the theme's `related` list plus other-pair words.
export function themeWordsFor(target) {
  const themeKey = TARGET_TO_THEME[target.toLowerCase()];
  if (!themeKey) return [];
  const theme = THEMES[themeKey];
  const out = [...theme.related];
  for (const [a, b] of theme.pairs) {
    if (a === target) continue;
    if (b === target) continue;
    // Include both — they're related concepts in the same theme, not
    // opponents of THIS target.
    out.push(a, b);
  }
  return out;
}

// Pick a random pair not in `avoidSet` (a Set of "p|a" strings).
// If all are avoided, ignore the filter (server doesn't manage seen-state).
export function pickPair(avoidSet) {
  const available = PAIRS.filter(([p, a]) => !avoidSet.has(`${p}|${a}`));
  const pool = available.length > 0 ? available : PAIRS;
  return pool[Math.floor(Math.random() * pool.length)];
}
