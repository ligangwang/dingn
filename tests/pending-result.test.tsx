// A signed-out player's challenge score, kept while they sign in.
import { beforeEach, expect, it } from "vitest";
import { keepPendingResult, takePendingResult } from "../src/lib/challenges";

beforeEach(() => sessionStorage.clear());

it("keeps the best of several rounds of the same challenge", () => {
  keepPendingResult("Xq3v9TzK1bWm", 20);
  keepPendingResult("Xq3v9TzK1bWm", 5);
  expect(takePendingResult("Xq3v9TzK1bWm")).toBe(20);
  // Taken once.
  expect(takePendingResult("Xq3v9TzK1bWm")).toBeNull();
});

it("starts again for another challenge, and gives nothing to a different one", () => {
  keepPendingResult("Xq3v9TzK1bWm", 20);
  keepPendingResult("AAAAAAAAAAAA", 3);
  expect(takePendingResult("Xq3v9TzK1bWm")).toBeNull();
  expect(takePendingResult("AAAAAAAAAAAA")).toBe(3);
});
