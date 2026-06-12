// Porter Stemmer (public domain; original algorithm by Martin Porter, 1980).
// Ported to JS — no dependencies. Lower-cases input. Returns a string stem.
//
// Usage: stem("oceans") === stem("ocean") === "ocean"
//        stem("running") === "run"

const step2List = {
  ational: "ate", tional: "tion", enci: "ence", anci: "ance",
  izer: "ize", bli: "ble", alli: "al", entli: "ent", eli: "e",
  ousli: "ous", ization: "ize", ation: "ate", ator: "ate",
  alism: "al", iveness: "ive", fulness: "ful", ousness: "ous",
  aliti: "al", iviti: "ive", biliti: "ble", logi: "log"
};

const step3List = {
  icate: "ic", ative: "", alize: "al", iciti: "ic", ical: "ic",
  ful: "", ness: ""
};

const c = "[^aeiou]";        // consonant
const v = "[aeiouy]";        // vowel
const C = c + "[^aeiouy]*";  // consonant sequence
const V = v + "[aeiou]*";    // vowel sequence

const mgr0 = "^(" + C + ")?" + V + C;                              // [C]VC...
const meq1 = "^(" + C + ")?" + V + C + "(" + V + ")?$";            // [C]VC[V]
const mgr1 = "^(" + C + ")?" + V + C + V + C;                      // [C]VCVC...
const sv   = "^(" + C + ")?" + v;                                  // vowel in stem

export function stem(w) {
  if (typeof w !== "string") return "";
  w = w.toLowerCase().trim();
  if (w.length < 3) return w;

  let stem;
  let suffix;
  let firstch;
  let re, re2, re3, re4;

  // Handle initial 'y'
  if (w.substr(0, 1) === "y") {
    firstch = w.substr(0, 1);
    w = firstch.toUpperCase() + w.substr(1);
  }

  // Step 1a
  re  = /^(.+?)(ss|i)es$/;
  re2 = /^(.+?)([^s])s$/;
  if (re.test(w))      w = w.replace(re,  "$1$2");
  else if (re2.test(w)) w = w.replace(re2, "$1$2");

  // Step 1b
  re  = /^(.+?)eed$/;
  re2 = /^(.+?)(ed|ing)$/;
  if (re.test(w)) {
    const fp = re.exec(w);
    re = new RegExp(mgr0);
    if (re.test(fp[1])) {
      re = /.$/;
      w = w.replace(re, "");
    }
  } else if (re2.test(w)) {
    const fp = re2.exec(w);
    stem = fp[1];
    re2 = new RegExp(sv);
    if (re2.test(stem)) {
      w = stem;
      re2 = /(at|bl|iz)$/;
      re3 = new RegExp("([^aeiouylsz])\\1$");
      re4 = new RegExp("^" + C + v + "[^aeiouwxy]$");
      if (re2.test(w))                    w = w + "e";
      else if (re3.test(w)) { re = /.$/;  w = w.replace(re, ""); }
      else if (re4.test(w))               w = w + "e";
    }
  }

  // Step 1c
  re = /^(.+?)y$/;
  if (re.test(w)) {
    const fp = re.exec(w);
    stem = fp[1];
    re = new RegExp(sv);
    if (re.test(stem)) w = stem + "i";
  }

  // Step 2
  re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
  if (re.test(w)) {
    const fp = re.exec(w);
    stem = fp[1];
    suffix = fp[2];
    re = new RegExp(mgr0);
    if (re.test(stem)) w = stem + step2List[suffix];
  }

  // Step 3
  re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
  if (re.test(w)) {
    const fp = re.exec(w);
    stem = fp[1];
    suffix = fp[2];
    re = new RegExp(mgr0);
    if (re.test(stem)) w = stem + step3List[suffix];
  }

  // Step 4
  re  = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
  re2 = /^(.+?)(s|t)(ion)$/;
  if (re.test(w)) {
    const fp = re.exec(w);
    stem = fp[1];
    re = new RegExp(mgr1);
    if (re.test(stem)) w = stem;
  } else if (re2.test(w)) {
    const fp = re2.exec(w);
    stem = fp[1] + fp[2];
    re2 = new RegExp(mgr1);
    if (re2.test(stem)) w = stem;
  }

  // Step 5
  re = /^(.+?)e$/;
  if (re.test(w)) {
    const fp = re.exec(w);
    stem = fp[1];
    re  = new RegExp(mgr1);
    re2 = new RegExp(meq1);
    re3 = new RegExp("^" + C + v + "[^aeiouwxy]$");
    if (re.test(stem) || (re2.test(stem) && !re3.test(stem))) w = stem;
  }

  re = /ll$/;
  re2 = new RegExp(mgr1);
  if (re.test(w) && re2.test(w)) {
    re = /.$/;
    w = w.replace(re, "");
  }

  // Restore initial 'y'
  if (firstch === "y") w = firstch + w.substr(1);
  return w;
}
