import { beforeEach, expect, it, vi } from "vitest";
import { randomWord, saveFavorite, saveProfile } from "../src/lib/repository";
const sdk = vi.hoisted(() => ({
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("../src/lib/firebase", () => ({ firebase: () => ({ db: {} }) }));
vi.mock("firebase/firestore", () => ({
  ...sdk,
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => `${name}/${id}`,
  query: (...args: unknown[]) => args,
  where: (...args: unknown[]) => args,
  orderBy: (field: string) => field,
  limit: (n: number) => n,
  startAfter: (cursor: unknown) => cursor,
}));
beforeEach(() => {
  vi.resetAllMocks();
  sdk.setDoc.mockResolvedValue(undefined);
});
it("updates legacy account and favorite documents with merge semantics", async () => {
  await saveProfile("u1", { userName: "Lee", cardSide: "TwoSides" });
  expect(sdk.setDoc).toHaveBeenCalledWith(
    "accounts/u1",
    { user_name: "Lee", card_side: "TwoSides" },
    { merge: true },
  );
  await saveFavorite("u1", "02", "sun");
  expect(sdk.setDoc).toHaveBeenLastCalledWith(
    "number_favorites/u1-02",
    { uid: "u1", number: "02", favoriteWord: "sun" },
    { merge: true },
  );
});
it("wraps random-word selection when the random pivot is after the last word", async () => {
  sdk.getDocs
    .mockResolvedValueOnce({ empty: true, docs: [] })
    .mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "name", data: () => ({ number: "23" }) }],
    });
  expect((await randomWord())?.word).toBe("name");
  expect(sdk.getDocs).toHaveBeenCalledTimes(2);
});
it("surfaces failed writes rather than reporting saved data", async () => {
  sdk.setDoc.mockRejectedValue(new Error("offline"));
  await expect(saveFavorite("u1", "02", "sun")).rejects.toThrow("offline");
});
