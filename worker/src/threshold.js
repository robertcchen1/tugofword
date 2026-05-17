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
// of half the arena)? When threshold = 1.0 the pit is at its minimum (narrow);
// when threshold = 0.3 the pit nearly reaches the cats.
export function pitHalfWidthFor(round) {
  const t = thresholdFor(round);
  // Map threshold 1.0 -> pit 0.08, threshold 0.3 -> pit 0.45.
  return 0.08 + (1 - t) * 0.53;
}
