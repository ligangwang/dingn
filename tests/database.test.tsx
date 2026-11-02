import { afterEach, expect, it, vi } from "vitest";
import {
  collection,
  database,
  getDocs,
  orderBy,
  query,
  startAfter,
  limit,
  setDoc,
  doc,
  serverTimestamp,
} from "../src/lib/database";
afterEach(() => vi.unstubAllGlobals());
it("keeps Firestore cursor wire types, document tiebreaker and timestamp decoding", async () => {
  const name = "projects/dingn-193716/databases/(default)/documents/feedback/a";
  const fields = {
    createdAt: { timestampValue: "2026-11-02T10:00:00Z" },
    message: { stringValue: "Hello" },
  };
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ document: { name, fields } }],
  });
  vi.stubGlobal("fetch", fetcher);
  const first = await getDocs(
    query(
      collection(database, "feedback"),
      orderBy("createdAt", "desc"),
      limit(25),
    ),
  );
  expect(first.docs[0].data().createdAt.toDate().toISOString()).toBe(
    "2026-11-02T10:00:00.000Z",
  );
  await getDocs(
    query(
      collection(database, "feedback"),
      orderBy("createdAt", "desc"),
      startAfter(first.docs[0]),
      limit(25),
    ),
  );
  const body = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(body.query.startAt).toEqual({
    before: false,
    values: [fields.createdAt, { referenceValue: name }],
  });
  expect(body.query.orderBy[1]).toEqual({
    field: { fieldPath: "__name__" },
    direction: "DESCENDING",
  });
});
it("encodes legacy fields, leading zeroes, arrays and server timestamps", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetcher);
  await setDoc(
    doc(database, "accounts", "u1"),
    { number: "02", words: ["sun"], createdAt: serverTimestamp() },
    { merge: true },
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body).fields).toEqual({
    number: { stringValue: "02" },
    words: { arrayValue: { values: [{ stringValue: "sun" }] } },
    createdAt: { serverTimestamp: true },
  });
});
