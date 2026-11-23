import { afterEach, expect, it, vi } from "vitest";
import { claimReferral, noteArrival, referralOpen } from "../src/lib/referral";
import { rememberChallenge } from "../src/lib/my-challenges";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const answer = (body: unknown) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body)));

it("keeps the first challenge a browser arrives through, never its own", async () => {
  rememberChallenge("MineMineMine");
  noteArrival("MineMineMine");
  expect(referralOpen()).toBe(false);
  noteArrival("FirstFriend1");
  noteArrival("SecondFrien2");
  const fetch = answer({ state: "joined", coins: 100 });
  expect(await claimReferral()).toEqual({ state: "joined", coins: 100 });
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    challenge: "FirstFriend1",
  });
  // Joined: still open, for the friend's coins when the player comes back.
  expect(referralOpen()).toBe(true);
  answer({ state: "waiting" });
  await claimReferral();
  expect(referralOpen()).toBe(true);
  answer({ state: "returned" });
  await claimReferral();
  expect(referralOpen()).toBe(false);
  // Nothing more to ask.
  const none = answer({});
  none.mockClear();
  expect(await claimReferral()).toBeNull();
  expect(none).not.toHaveBeenCalled();
});

it("stops asking once dingn says the account doesn't qualify", async () => {
  noteArrival("FirstFriend1");
  answer({ state: "none" });
  await claimReferral();
  expect(referralOpen()).toBe(false);
});

it("notes who shared the link, even for a challenge made in this browser", async () => {
  rememberChallenge("MineMineMine");
  noteArrival("MineMineMine", "1234567890");
  const fetch = answer({ state: "joined", coins: 100 });
  await claimReferral();
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    challenge: "MineMineMine",
    ref: "1234567890",
  });
});

it("notes a sharer's link that opens no challenge", async () => {
  noteArrival(null);
  expect(referralOpen()).toBe(false);
  noteArrival(null, "1234567890");
  const fetch = answer({ state: "none" });
  await claimReferral();
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    ref: "1234567890",
  });
});
