// Word validation.
// Two-tier: a small bundled bloom-style allowlist of very common roots (instant pass),
// then a network fallback to the Free Dictionary API for the long tail.
//
// We deliberately keep the bundled list small (~1k) to keep the Worker bundle slim.
// Anything not in the list falls through to the dictionary API.

const COMMON_WORDS = new Set([
  // Targets (always-valid)
  "space","ocean","forest","desert","mountain","valley","river","canyon",
  "volcano","glacier","sun","moon","dawn","dusk","comet","planet","lightning",
  "rainbow","wolf","whale","eagle","snake","tiger","dolphin","owl","sparrow",
  "fire","water","earth","air","ice","steam","sand","stone","spring","autumn",
  "morning","midnight","past","future","joy","sorrow","anger","calm","fear",
  "courage","castle","cottage","skyscraper","cabin","bridge","tunnel","piano",
  "drum","painting","sculpture","jazz","symphony","bread","sushi","coffee",
  "tea","cake","salad","order","chaos","dream","reality","silence","noise",
  "lion","shark","horse","cat","dog","bear","fish","bird","tree","flower",
  "leaf","grass","cloud","wind","rain","snow","star","sky","light","dark",
  "day","night","cold","heat","summer","winter","green","blue","red","yellow",
  "black","white","gold","silver","iron","wood","glass","metal","silk","wool",
  "city","town","village","farm","beach","island","cave","hill","field","road",
  "house","room","door","window","wall","floor","roof","garden","park","street",
  "book","paper","pen","ink","letter","word","story","poem","song","music",
  "dance","art","film","photo","game","play","race","run","walk","jump",
  "swim","fly","fall","rise","grow","build","make","break","fix","clean",
  "smile","laugh","cry","sleep","wake","eat","drink","cook","bake","brew",
  "love","hate","hope","trust","peace","war","life","death","birth","time",
  "year","month","week","hour","minute","second","king","queen","prince","knight",
  "wizard","dragon","ghost","monster","hero","villain","sword","shield","bow",
  "arrow","spear","crown","jewel","ring","key","map","compass","ship","boat",
  "car","train","plane","bike","wheel","engine","fuel","oil","gas","power",
  "computer","phone","screen","button","wire","chip","robot","machine","tool",
  "factory","office","school","store","market","bank","hospital","church",
  "temple","tower","wall","gate","yard","barn","stable","forest","jungle",
  "swamp","tundra","reef","lagoon","bay","cape","cliff","dune","meadow","prairie",
  "lake","pond","stream","creek","sea","wave","tide","current","shore","coast",
  "salt","sugar","spice","flour","milk","butter","cheese","egg","meat","rice",
  "pasta","soup","stew","pie","cookie","candy","fruit","apple","orange","banana",
  "grape","berry","peach","pear","plum","lemon","lime","cherry","melon","mango",
  "vegetable","carrot","potato","onion","garlic","tomato","pepper","corn","bean",
  "pea","nut","seed","root","stem","branch","bark","trunk","petal","thorn",
  // Days, months, common proper-noun-ish words that dictionaryapi.dev
  // returns 404 for (it treats these as proper nouns, not lemmas).
  "monday","tuesday","wednesday","thursday","friday","saturday","sunday",
  "january","february","march","april","may","june","july","august",
  "september","october","november","december",
  "weekday","weekend","holiday","birthday","anniversary","weekend"
]);

const cache = new Map();

export async function isRealWord(word) {
  if (!word || typeof word !== "string") return false;
  const w = word.toLowerCase().trim();
  if (!/^[a-z]+$/.test(w) || w.length < 2 || w.length > 30) return false;
  if (COMMON_WORDS.has(w)) return true;
  if (cache.has(w)) return cache.get(w);

  try {
    const r = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`,
      { signal: AbortSignal.timeout(2500) }
    );
    // Trust the dictionary API as authoritative.
    //   200 ok → real word
    //   404    → not a recognised word, reject
    // The proper-noun gap (monday, october, etc.) is already handled by
    // the COMMON_WORDS allowlist at the top of this function, so we
    // don't need a permissive 404 fallback that would also let "asdf"
    // through.
    const ok = r.ok;
    cache.set(w, ok);
    return ok;
  } catch {
    // Network/timeout: be permissive rather than block the game.
    // (Don't cache — let the next request try the API again.)
    return true;
  }
}
