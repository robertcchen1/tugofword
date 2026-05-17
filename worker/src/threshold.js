// Sudden-death threshold curve.
//
// Rounds 1..5: standard threshold = 1.0 (full rope length to either side wins).
// Round 6+:    threshold shrinks 10% per round, floor at 0.3.
//
// The "pit half-width" rendered on the frontend is the inverse — as the
// threshold shrinks, the pit appears to widen toward the cats.

export function thresholdFor(round) {
  if (round <= 5) return 1.0;
  return Math.max(0.3, Math.pow(0.9, round - 5));
}

// Convenience for the client: how wide should the pit appear (as a fraction
// of TOTAL arena width — so 0.18 means the pit extends 18% of the arena
// width to either side of center).
//
// Cats are anchored 20% from center on each side (normalized 0.2). The pit
// max must stay just inside that so the cat doesn't visually overlap the
// pit at rest. The frontend separately drives the cat lean so that when
// ropePos = ±threshold, the losing cat's center lands at the pit edge —
// triggering the fall right when the pit "reaches" the cat.
export function pitHalfWidthFor(round) {
  const t = thresholdFor(round);
  // At t = 1.0 (rounds 1-5):    pit = 0.04 (small, decorative)
  // At t = 0.3 (deep sudden death): pit = 0.18 (just inside cat at 0.20)
  return 0.04 + (1 - t) * 0.20;
}
