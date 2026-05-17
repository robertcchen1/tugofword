// 100 curated categorically-related target word pairs.
// Each pair shares a category so the game is interesting (player and AI
// pull toward semantically-close but contrasting concepts).
//
// Format: [playerTarget, aiTarget]

export const PAIRS = [
  // Nature & landscape (10)
  ["space", "ocean"], ["forest", "desert"], ["mountain", "valley"],
  ["river", "canyon"], ["volcano", "glacier"], ["jungle", "tundra"],
  ["meadow", "swamp"], ["island", "peninsula"], ["cliff", "beach"],
  ["cave", "summit"],

  // Sky & cosmos (10)
  ["sun", "moon"], ["dawn", "dusk"], ["comet", "planet"],
  ["lightning", "rainbow"], ["star", "cloud"], ["galaxy", "atmosphere"],
  ["eclipse", "aurora"], ["meteor", "satellite"], ["nebula", "horizon"],
  ["sunrise", "sunset"],

  // Animals (10)
  ["wolf", "whale"], ["eagle", "snake"], ["tiger", "dolphin"],
  ["owl", "sparrow"], ["lion", "shark"], ["horse", "octopus"],
  ["bear", "rabbit"], ["hawk", "salmon"], ["fox", "turtle"],
  ["deer", "crab"],

  // Elements (10)
  ["fire", "water"], ["earth", "air"], ["ice", "steam"],
  ["sand", "stone"], ["lava", "frost"], ["wood", "metal"],
  ["smoke", "mist"], ["dust", "mud"], ["coal", "diamond"],
  ["clay", "glass"],

  // Time & seasons (10)
  ["spring", "autumn"], ["morning", "midnight"], ["past", "future"],
  ["summer", "winter"], ["dawn", "twilight"], ["yesterday", "tomorrow"],
  ["century", "moment"], ["ancient", "modern"], ["sunrise", "midnight"],
  ["youth", "elder"],

  // Emotions (10)
  ["joy", "sorrow"], ["anger", "calm"], ["fear", "courage"],
  ["love", "hatred"], ["hope", "despair"], ["pride", "shame"],
  ["excitement", "boredom"], ["wonder", "disgust"], ["envy", "gratitude"],
  ["serenity", "panic"],

  // Architecture (10)
  ["castle", "cottage"], ["skyscraper", "cabin"], ["bridge", "tunnel"],
  ["temple", "factory"], ["palace", "hut"], ["library", "warehouse"],
  ["cathedral", "shed"], ["fortress", "tent"], ["mansion", "shack"],
  ["museum", "barn"],

  // Music & art (10)
  ["piano", "drum"], ["painting", "sculpture"], ["jazz", "symphony"],
  ["violin", "guitar"], ["opera", "ballet"], ["mural", "mosaic"],
  ["sketch", "photograph"], ["flute", "trumpet"], ["choir", "soloist"],
  ["watercolor", "charcoal"],

  // Food (10)
  ["bread", "sushi"], ["coffee", "tea"], ["cake", "salad"],
  ["pasta", "rice"], ["soup", "sandwich"], ["chocolate", "vanilla"],
  ["pizza", "burger"], ["cheese", "honey"], ["apple", "mango"],
  ["pancake", "omelette"],

  // Abstract concepts (10)
  ["order", "chaos"], ["dream", "reality"], ["silence", "noise"],
  ["truth", "fiction"], ["freedom", "duty"], ["light", "shadow"],
  ["wisdom", "innocence"], ["beginning", "ending"], ["question", "answer"],
  ["memory", "forgetting"]
];

// Pick a random pair not in `avoidSet` (a Set of "p|a" strings).
// If all are avoided, ignore the filter (server doesn't manage seen-state).
export function pickPair(avoidSet) {
  const available = PAIRS.filter(([p, a]) => !avoidSet.has(`${p}|${a}`));
  const pool = available.length > 0 ? available : PAIRS;
  return pool[Math.floor(Math.random() * pool.length)];
}
