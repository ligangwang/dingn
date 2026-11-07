/**
 * Bubble Calm — rules for a never-ending sheet of bubble wrap.
 * Pure and deterministic (seeded) so it can be tested without a canvas.
 * Coordinates are in sheet units: a bubble has radius 0.5 and centres
 * sit on a hexagonal grid with 1-unit horizontal spacing.
 */
export type Bubble = {
  id: number;
  col: number;
  row: number;
  /** Centre, in sheet units. */
  x: number;
  y: number;
  golden: boolean;
  popped: boolean;
  /** Seconds since the sheet started when this bubble popped. */
  poppedAt: number;
  /** Per-bubble variety for sound pitch and wrinkle shape (0..1). */
  tone: number;
};
export type Sheet = {
  cols: number;
  rows: number;
  width: number;
  height: number;
  bubbles: Bubble[];
  remaining: number;
  palette: number;
};
export const PALETTES = 6;
export const ROW_STEP = Math.sqrt(3) / 2;
export const GOLDEN_CHANCE = 1 / 36;

/** Small fast PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a column/row count that fills an area with comfortably sized bubbles. */
export function fitGrid(
  pixelWidth: number,
  pixelHeight: number,
  targetDiameter = pixelWidth < 520 ? 46 : 58,
) {
  const cols = Math.max(
    4,
    Math.min(16, Math.floor(pixelWidth / targetDiameter - 0.5)),
  );
  const unit = pixelWidth / (cols + 0.5);
  const rows = Math.max(
    4,
    Math.min(14, Math.floor((pixelHeight / unit - 1) / ROW_STEP) + 1),
  );
  return { cols, rows };
}

export function newSheet(
  cols: number,
  rows: number,
  seed: number,
  palette = 0,
): Sheet {
  const random = rng(seed);
  const bubbles: Bubble[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      bubbles.push({
        id: bubbles.length,
        col,
        row,
        x: 0.5 + col + (row % 2 ? 0.5 : 0),
        y: 0.5 + row * ROW_STEP,
        golden: random() < GOLDEN_CHANCE,
        popped: false,
        poppedAt: 0,
        tone: random(),
      });
  return {
    cols,
    rows,
    width: cols + 0.5,
    height: 1 + (rows - 1) * ROW_STEP,
    bubbles,
    remaining: bubbles.length,
    palette: ((palette % PALETTES) + PALETTES) % PALETTES,
  };
}

/** The unpopped bubble under a point, if any. */
export function bubbleAt(sheet: Sheet, x: number, y: number, radius = 0.5) {
  const row = Math.round((y - 0.5) / ROW_STEP);
  let best: Bubble | undefined;
  let bestDistance = radius * radius;
  for (let r = row - 1; r <= row + 1; r++) {
    if (r < 0 || r >= sheet.rows) continue;
    const col = Math.round(x - 0.5 - (r % 2 ? 0.5 : 0));
    for (let c = col - 1; c <= col + 1; c++) {
      if (c < 0 || c >= sheet.cols) continue;
      const b = sheet.bubbles[r * sheet.cols + c];
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (!b.popped && d <= bestDistance) {
        best = b;
        bestDistance = d;
      }
    }
  }
  return best;
}

export function pop(sheet: Sheet, bubble: Bubble, time: number) {
  if (bubble.popped) return false;
  bubble.popped = true;
  bubble.poppedAt = time;
  sheet.remaining--;
  return true;
}

/**
 * Pops every bubble the pointer swept over between two points. Sampling the
 * segment keeps fast swipes from skipping bubbles.
 */
export function sweep(
  sheet: Sheet,
  from: { x: number; y: number },
  to: { x: number; y: number },
  time: number,
  radius = 0.45,
) {
  const popped: Bubble[] = [];
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(length / 0.2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const b = bubbleAt(
      sheet,
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
      radius,
    );
    if (b && pop(sheet, b, time)) popped.push(b);
  }
  return popped;
}

/** The next unpopped bubble in reading order (keyboard play). */
export function nextBubble(sheet: Sheet) {
  return sheet.bubbles.find((b) => !b.popped);
}

/**
 * Pops that happen close together build a gentle streak. There is no
 * score to lose: the streak only makes the sound and sparkle a little brighter.
 */
export function nextStreak(streak: number, lastPopTime: number, now: number) {
  return now - lastPopTime < 0.35 ? Math.min(streak + 1, 40) : 1;
}
