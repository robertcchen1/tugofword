// Sudden-death threshold curve.
//
// Rounds 1..5: standard threshold = 0.5 (warm-up; both sides can build
//              rope position without much pressure).
// Round 6+:    sudden death — threshold shrinks 30% per round, floor at
//              0.08. Hits the floor by round 10, so even the longest
//              games rarely drag past round 11.

export function thresholdFor(round) {
  if (round <= 5) return 0.5;
  return Math.max(0.08, 0.5 * Math.pow(0.70, round - 5));
}

// Pit half-width (fraction of TOTAL arena width — so 0.20 means pit edge
// reaches the cat at normalized 0.20).
//
// Linear interpolation: pit grows from 0.04 (at max threshold 0.5) to 0.20
// (when threshold approaches 0 — pit edge at the cat). The frontend's cat
// lean stays in sync so the losing cat's centre lands at the pit edge
// exactly when ropePos = ±threshold.
export function pitHalfWidthFor(round) {
  const t = thresholdFor(round);
  // pit = 0.20 - t * 0.32
  //   t=0.50 → pit=0.04 (small, decorative)
  //   t=0.20 → pit=0.136
  //   t=0.08 (floor) → pit=0.174 (close to cat at 0.20)
  return Math.max(0.04, 0.20 - t * 0.32);
}
