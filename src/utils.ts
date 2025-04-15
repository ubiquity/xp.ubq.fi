export function isProduction(): boolean {
  return window.location.hostname === "xp.ubq.fi";
}

export function getRunIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("run");
}

/**
 * Cubic bezier easing function.
 * @param x1 Control point 1 X
 * @param y1 Control point 1 Y
 * @param x2 Control point 2 X
 * @param y2 Control point 2 Y
 * @param t Time (0 to 1)
 * @returns Eased value (0 to 1)
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t: number): number {
    return ((ax * t + bx) * t + cx) * t;
  }

  function sampleCurveY(t: number): number {
    return ((ay * t + by) * t + cy) * t;
  }

  function solveCurveX(x: number): number {
    let t0 = 0;
    let t1 = 1;
    let t2 = x;

    for (let i = 0; i < 8; i++) {
      const x2 = sampleCurveX(t2);
      if (Math.abs(x2 - x) < 0.001) return t2;
      const d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
      if (Math.abs(d2) < 0.000001) break;
      t2 = t2 - (x2 - x) / d2;
    }

    // Fallback using linear interpolation
    let low = 0;
    let high = 1;
    t2 = x;

    if (t2 < low) return low;
    if (t2 > high) return high;

    while (low < high) {
      const x2 = sampleCurveX(t2);
      if (Math.abs(x2 - x) < 0.001) return t2;
      if (x2 < x) low = t2;
      else high = t2;
      t2 = (high - low) / 2 + low;
    }
    return t2; // Fallback if solver fails
  }

  return sampleCurveY(solveCurveX(t));
}
