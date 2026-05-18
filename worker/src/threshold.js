// Sudden-death threshold curve.
//
// Tuned so most games end by round 8-10. Typical per-turn pulls are
// 0.05-0.2; cumulative rope position rarely exceeds 0.5 by round 10
// when both sides play well. So the win threshold needs to drop into
// that range quickly.
//
// Rounds 1..2: standard threshold = 0.5 (warm-up; only a strong streak wins).
// Round 3+:    threshold shrinks ~20% per round, floor at 0.08.
//
// The "pit half-width" rendered on the frontend is the inverse — as the
// threshold shrinks, the pit appears to widen toward the cats.

export function thresholdFor(round) {
  if (round <= 2) return 0.5;
  return Math.max(0.08, 0.5 * Math.pow(0.80, round - 2));
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
