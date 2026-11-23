// Coins for friends brought through challenge links.
import "./kingdom-rules.mjs";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, referrals, store, rewards;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dingn-referrals-"));
  process.env.GAMES_LOCAL_DIR = dir;
  referrals = await import("../scripts/referrals.mjs");
  store = await import("../scripts/platform-store.mjs");
  rewards = await import("../scripts/rewards.mjs");
});
after(() => rm(dir, { recursive: true, force: true }));

/** A challenge `id` made by `uid` (null for a guest) at `at`. */
const challenge = (id, uid, at = "2026-11-20T10:00:00.000Z") =>
  store.mergeDoc("challenges", id, {
    game: "gemsurge",
    mode: "level",
    seed: "3",
    score: 1234,
    unit: "points",
    rules: null,
    uid,
    name: null,
    createdAt: at,
    public: false,
  });

/** The friend `uid` (made at `made`) asks dingn after a round at `now`. */
function claim(
  uid,
  id,
  {
    made = "2026-11-20T11:00:00.000Z",
    now = "2026-11-20T12:00:00.000Z",
    signedIn = true,
    verified = true,
    tester = false,
    ref,
    testers = [],
  } = {},
) {
  const req = Object.assign(
    Readable.from([JSON.stringify({ challenge: id ?? undefined, ref })]),
    {
      method: "POST",
      url: "/api/referrals",
      headers: {
        origin: "http://127.0.0.1:3001",
        "x-dingn-request": "1",
        "content-type": "application/json",
      },
      socket: { remoteAddress: "127.0.0.1" },
    },
  );
  return new Promise((resolve) => {
    let status = 0;
    referrals.handleReferrals(
      req,
      {
        writeHead: (s) => (status = s),
        end: (b) => resolve({ status, body: JSON.parse(b) }),
        setHeader() {},
      },
      "/api/referrals",
      {
        exchange: async () => {
          if (!signedIn) {
            const { ApiError } = await import("../scripts/api.mjs");
            throw new ApiError(401, "sign-in-required");
          }
          return "t";
        },
        verify: async () => (tester ? { uid, tester: true } : { uid }),
        account: async () => ({ created: new Date(made), verified }),
        isTester: async (who) => testers.includes(who),
        now: () => now,
      },
    );
  });
}
const coins = async (uid) => (await store.getDoc("rewards", uid))?.coins ?? 0;

test("a new player who joins from a challenge gets 100 coins, and so does the friend who sent it", async () => {
  await challenge("ChallengeAda", "ada");
  const first = await claim("bo", "ChallengeAda");
  assert.deepEqual(first, {
    status: 200,
    body: { state: "joined", coins: 100 },
  });
  assert.equal(await coins("bo"), 100);
  assert.equal(await coins("ada"), 100);
  const saved = await store.getDoc("referrals", "bo");
  assert.equal(saved.referrer, "ada");
  assert.equal(saved.paidReferrer, true);
  // Asking again the same day pays nothing more.
  assert.equal((await claim("bo", "ChallengeAda")).body.state, "waiting");
  assert.equal(await coins("bo"), 100);
  assert.equal(await coins("ada"), 100);
  // Coming back another day pays the friend 100 more, once.
  const later = { now: "2026-11-21T09:00:00.000Z" };
  assert.equal(
    (await claim("bo", "ChallengeAda", later)).body.state,
    "returned",
  );
  assert.equal(await coins("ada"), 200);
  assert.equal(
    (await claim("bo", "ChallengeAda", later)).body.state,
    "returned",
  );
  assert.equal(await coins("ada"), 200);
  assert.equal(await coins("bo"), 100);
  assert.equal(rewards.wallet(await store.getDoc("rewards", "ada")).friends, 1);
});

test("existing members, guests' challenges and your own links earn nothing", async () => {
  await challenge("ChallengeCy1", "cy");
  await challenge("ChallengeGst", null);
  // An account made before the challenge was sent.
  assert.equal(
    (await claim("di", "ChallengeCy1", { made: "2026-11-01T00:00:00.000Z" }))
      .body.state,
    "none",
  );
  // An email address never confirmed.
  assert.equal(
    (await claim("jo", "ChallengeCy1", { verified: false })).body.state,
    "none",
  );
  // An admin's test account.
  assert.equal(
    (await claim("ko", "ChallengeCy1", { tester: true })).body.state,
    "none",
  );
  // A challenge a test account made.
  await challenge("ChallengeQa1", "qa");
  await store.mergeDoc("challenges", "ChallengeQa1", { test: true });
  assert.equal((await claim("lu", "ChallengeQa1")).body.state, "none");
  // Your own challenge.
  assert.equal((await claim("cy", "ChallengeCy1")).body.state, "none");
  // A guest's challenge has nobody to pay.
  assert.equal((await claim("ed", "ChallengeGst")).body.state, "none");
  // An account more than 30 days old, or no such challenge.
  await challenge("ChallengeOld", "cy", "2026-09-01T00:00:00.000Z");
  assert.equal(
    (await claim("fy", "ChallengeOld", { made: "2026-09-02T00:00:00.000Z" }))
      .body.state,
    "none",
  );
  assert.equal((await claim("gu", "NoSuchChalle")).body.state, "none");
  assert.equal((await claim("gu", "../x")).body.state, "none");
  for (const uid of ["cy", "di", "ed", "fy", "gu", "jo", "ko", "lu", "qa"])
    assert.equal(await coins(uid), 0, uid);
  // Signed out: nothing to pay.
  assert.equal(
    (await claim("hi", "ChallengeCy1", { signedIn: false })).status,
    401,
  );
});

test("every friend counts, with badges and bonus coins at 3, 10, 25 and 50", () => {
  let doc = null;
  let paid = 0;
  const at = (n) =>
    `2026-11-${String(1 + Math.floor(n / 10)).padStart(2, "0")}T12:00:00.000Z`;
  for (let n = 0; n < 50; n++) {
    const next = referrals.inviterJoined(doc, at(n));
    doc = next.doc;
    paid += next.coins;
  }
  assert.equal(doc.referrals.friends, 50);
  assert.deepEqual(Object.keys(doc.badges).sort(), [
    "dingn/friends-10",
    "dingn/friends-25",
    "dingn/friends-3",
    "dingn/friends-50",
  ]);
  // 100 a friend, plus 100 + 300 + 750 + 1,500 for the badges.
  assert.equal(paid, 50 * 100 + 100 + 300 + 750 + 1500);
  assert.equal(doc.coins, paid);
  assert.equal(doc.badges["dingn/friends-10"].tier, "silver");
});

test("past 10 friends in one day, more still count but aren't paid that day", () => {
  let doc = null;
  const day = "2026-11-20T12:00:00.000Z";
  for (let n = 0; n < 12; n++) doc = referrals.inviterJoined(doc, day).doc;
  assert.equal(doc.referrals.friends, 12);
  // 10 paid joins, plus the badges at 3 and 10.
  assert.equal(doc.coins, 10 * 100 + 100 + 300);
  // The next day pays again.
  const next = referrals.inviterJoined(doc, "2026-11-21T12:00:00.000Z");
  assert.equal(next.paid, true);
  assert.equal(next.coins, 100);
});

test("a retried transaction decides afresh, so a friend is never paid twice", () => {
  const now = "2026-11-20T12:00:00.000Z";
  const writes = referrals.joinWrites(
    "ChallengeAda",
    { uid: "ada", game: "gemsurge" },
    now,
  );
  // First attempt: nothing recorded yet, so all three are written together.
  const first = writes([null, null, null]);
  assert.equal(first[0].referrer, "ada");
  assert.equal(first[1].coins, 100);
  assert.equal(first[2].coins, 100);
  // A retry after another request recorded the friend writes nothing.
  assert.deepEqual(writes([first[0], first[1], first[2]]), [
    undefined,
    undefined,
    undefined,
  ]);
  // The same for the return payment.
  const later = referrals.returnWrites("2026-11-21T09:00:00.000Z");
  const paid = later([first[0], first[2]]);
  assert.equal(paid[1].coins, 200);
  assert.deepEqual(later([paid[0], paid[1]]), [undefined, undefined]);
  // Not on the day they joined.
  assert.deepEqual(referrals.returnWrites(now)([first[0], first[2]]), [
    undefined,
    undefined,
  ]);
});

test("a friend belongs to whoever shared the link they came through, not the challenge's maker", async () => {
  await challenge("ChallengeEve", "eve", "2026-11-20T10:00:00.000Z");
  await store.mergeDoc("playerNumbers", "1234567890", { uid: "sharer" });
  await store.mergeDoc("playerNumbers", "2234567890", { uid: "tess" });
  // Joined through the sharer's copy of eve's challenge: the sharer's friend.
  const joined = await claim("fay", "ChallengeEve", { ref: "1234567890" });
  assert.equal(joined.body.state, "joined");
  assert.equal(await coins("sharer"), 100);
  assert.equal(await coins("eve"), 0);
  const saved = await store.getDoc("referrals", "fay");
  assert.equal(saved.referrer, "sharer");
  assert.equal(saved.ref, "1234567890");
  assert.equal(saved.challenge, "ChallengeEve");
  // The sharer's link counts for a challenge older than the friend too...
  // and with no challenge at all.
  const bare = await claim("gil", null, { ref: "1234567890" });
  assert.equal(bare.body.state, "joined");
  assert.equal(await coins("sharer"), 200);
  assert.equal((await store.getDoc("referrals", "gil")).challenge, null);
  // A number nobody has, or a test account's, leaves the challenge's maker.
  assert.equal(
    (await claim("hal", "ChallengeEve", { ref: "9999999999" })).body.state,
    "joined",
  );
  assert.equal((await store.getDoc("referrals", "hal")).referrer, "eve");
  assert.equal(
    (
      await claim("ivy", "ChallengeEve", {
        ref: "2234567890",
        testers: ["tess"],
      })
    ).body.state,
    "joined",
  );
  assert.equal((await store.getDoc("referrals", "ivy")).referrer, "eve");
  // Nobody is their own friend, and a bare made-up number brings nobody.
  assert.equal(
    (await claim("sharer", null, { ref: "1234567890" })).body.state,
    "none",
  );
  assert.equal(
    (await claim("jo", null, { ref: "9999999999" })).body.state,
    "none",
  );
  assert.equal((await claim("kim", null, { ref: "nope" })).body.state, "none");
});

test("an inviter sees the friends they brought and the coins each earned them", async () => {
  await challenge("ChallengeLou", "lou");
  await store.mergeDoc("accounts", "max", {
    user_name: "Max",
    player_no: "3234567890",
  });
  await claim("max", "ChallengeLou", { now: "2026-11-20T12:00:00.000Z" });
  await claim("ned", "ChallengeLou", { now: "2026-11-20T13:00:00.000Z" });
  await claim("max", "ChallengeLou", { now: "2026-11-21T09:00:00.000Z" });
  assert.deepEqual(await referrals.friendsOf("lou"), [
    {
      name: null,
      joinedAt: "2026-11-20T13:00:00.000Z",
      returned: false,
      coins: 100,
    },
    {
      name: "Max",
      number: "3234567890",
      joinedAt: "2026-11-20T12:00:00.000Z",
      returned: true,
      coins: 200,
    },
  ]);
  assert.deepEqual(await referrals.friendsOf("nobody"), []);
});
