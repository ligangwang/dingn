import assert from "node:assert/strict";
import test from "node:test";
import {
  bubbleAt,
  fitGrid,
  newSheet,
  nextBubble,
  nextStreak,
  pop,
  sweep,
} from "../src/game/pop-core";

test("sheets are deterministic per seed and fill a hexagonal grid", () => {
  const a = newSheet(8, 6, 42, 3);
  const b = newSheet(8, 6, 42, 3);
  assert.deepEqual(a, b);
  assert.equal(a.bubbles.length, 48);
  assert.equal(a.remaining, 48);
  assert.equal(a.bubbles[8].x, 1); // odd rows are offset by half a bubble
  assert.equal(newSheet(2, 2, 1, -1).palette, 5);
});

test("hit testing finds only the unpopped bubble under the point", () => {
  const sheet = newSheet(5, 5, 7);
  const target = sheet.bubbles[12];
  assert.equal(bubbleAt(sheet, target.x + 0.2, target.y - 0.2), target);
  assert.equal(bubbleAt(sheet, -3, -3), undefined);
  assert.equal(pop(sheet, target, 1), true);
  assert.equal(pop(sheet, target, 2), false);
  assert.equal(sheet.remaining, 24);
  assert.equal(bubbleAt(sheet, target.x, target.y), undefined);
});

test("a fast swipe pops every bubble along its path exactly once", () => {
  const sheet = newSheet(10, 3, 9);
  const y = sheet.bubbles[0].y;
  const popped = sweep(sheet, { x: 0.5, y }, { x: 9.5, y }, 0);
  assert.equal(popped.length, 10);
  assert.equal(new Set(popped.map((b) => b.id)).size, 10);
  assert.equal(sweep(sheet, { x: 0.5, y }, { x: 9.5, y }, 0).length, 0);
});

test("keyboard play pops in reading order until the sheet is done", () => {
  const sheet = newSheet(4, 4, 3);
  let n = 0;
  for (let b = nextBubble(sheet); b; b = nextBubble(sheet)) {
    assert.equal(b.id, n++);
    pop(sheet, b, n);
  }
  assert.equal(n, 16);
  assert.equal(sheet.remaining, 0);
});

test("grids stay comfortably sized and streaks build only from quick pops", () => {
  const phone = fitGrid(360, 520);
  const desktop = fitGrid(1060, 600);
  assert.ok(phone.cols >= 4 && phone.cols < desktop.cols);
  assert.ok(desktop.cols <= 16 && desktop.rows <= 14);
  assert.equal(nextStreak(3, 1, 1.2), 4);
  assert.equal(nextStreak(3, 1, 2), 1);
  assert.equal(nextStreak(40, 1, 1.1), 40);
});
