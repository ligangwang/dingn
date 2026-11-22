// Coins for bringing friends to dingn through challenge links.
//
// A friend who opens someone's challenge link, makes a new dingn account and
// opens a game "joins": they get JOIN_COINS, and the player whose
// challenge brought them gets JOIN_COINS too. When the friend comes back and
// opens a game on another UTC day, the inviter gets RETURN_COINS more,
// so most of the reward goes to friends who stay. Every friend counts: the
// inviter's badges at 3, 10, 25 and 50 friends pay bonus coins on top.
//
//   POST /api/referrals { challenge }   (the signed-in friend, with a game open)
//   → { state: "joined", coins } | { state: "returned" | "waiting" | "none" }
//
// The player page calls it, without waiting on the game, as soon as a signed-in
// player has a game open while this browser holds a challenge it arrived through (src/lib/referral.ts). The friend's account
// must be new (made after the challenge) with a confirmed email address, and
// they can't be its maker, so existing members swapping links, accounts
// made with made-up addresses, or admins' test accounts, earn nothing. Each friend is recorded once,
// in server-only Firestore `referrals/{friend uid}`:
//
//   { referrer, challenge, game, joinedAt, joinDay, returnedAt, paidReferrer }
//
// and the inviter's count of friends lives in their rewards document as
// `referrals: { friends, day, paidToday }`. To slow scripted fake accounts,
// an inviter is paid for at most PAID_JOINS_PER_DAY friends a UTC day; more
// still count toward their badges.
import {
  ApiError,
  readBody,
  refresh,
  throttle,
  validateOrigin,
} from "./api.mjs";
import { getDoc, updateMany } from "./platform-store.mjs";
import { CHALLENGE_ID } from "../src/data/challenge.mjs";
import { hasRole } from "./roles.mjs";

export const referralRoutes = ["/api/referrals"];
export const JOIN_COINS = 100;
export const RETURN_COINS = 100;
export const PAID_JOINS_PER_DAY = 10;
/** A friend's account must be at most this old to count as new. */
export const NEW_ACCOUNT_DAYS = 30;
/** The inviter's badges, by friends joined, and the coins each pays. */
export const MILESTONES = [
  {
    friends: 3,
    id: "friends-3",
    tier: "bronze",
    icon: "squad",
    coins: 100,
    title: { en: "Brought 3 friends", zh: "带来 3 位朋友" },
  },
  {
    friends: 10,
    id: "friends-10",
    tier: "silver",
    icon: "heart",
    coins: 300,
    title: { en: "Brought 10 friends", zh: "带来 10 位朋友" },
  },
  {
    friends: 25,
    id: "friends-25",
    tier: "gold",
    icon: "crown",
    coins: 750,
    title: { en: "Brought 25 friends", zh: "带来 25 位朋友" },
  },
  {
    friends: 50,
    id: "friends-50",
    tier: "diamond",
    icon: "trophy",
    coins: 1500,
    title: { en: "Brought 50 friends", zh: "带来 50 位朋友" },
  },
];
/** Badges and coins from dingn itself, not a game. */
const DINGN = "dingn";

const day = (iso) => iso.slice(0, 10);

/** Adds coins to a rewards document, as coins from dingn. */
function pay(doc, coins) {
  return {
    ...(doc ?? {}),
    coins: (doc?.coins ?? 0) + coins,
    games: {
      ...(doc?.games ?? {}),
      [DINGN]: (doc?.games?.[DINGN] ?? 0) + coins,
    },
  };
}

/**
 * The inviter's rewards document after a friend joins: one more friend, the
 * join coins unless today's paid joins are used up, and any milestone badge
 * reached (with its coins). Returns the new document and what was paid.
 */
export function inviterJoined(doc, now) {
  const today = day(now);
  const was = doc?.referrals ?? { friends: 0, day: today, paidToday: 0 };
  const paidToday = was.day === today ? was.paidToday : 0;
  const paid = paidToday < PAID_JOINS_PER_DAY;
  const friends = was.friends + 1;
  let next = paid ? pay(doc, JOIN_COINS) : { ...(doc ?? {}) };
  next.referrals = {
    friends,
    day: today,
    paidToday: paidToday + (paid ? 1 : 0),
  };
  let coins = paid ? JOIN_COINS : 0;
  const reached = MILESTONES.find((m) => m.friends === friends);
  if (reached && !next.badges?.[`${DINGN}/${reached.id}`]) {
    next = pay(next, reached.coins);
    next.badges = {
      ...(next.badges ?? {}),
      [`${DINGN}/${reached.id}`]: {
        game: DINGN,
        id: reached.id,
        tier: reached.tier,
        icon: reached.icon,
        title: reached.title,
        coins: reached.coins,
        at: now,
      },
    };
    coins += reached.coins;
  }
  return { doc: next, coins, paid };
}

async function signedInClaims(req, res, verify, exchange) {
  const token = await exchange(req, res);
  try {
    return await (
      verify ??
      (async (t) =>
        (
          await (await import("./games-admin.mjs")).firebaseAuth()
        ).verifyIdToken(t))
    )(token);
  } catch {
    throw new ApiError(401, "invalid-credential");
  }
}

/** When the account `uid` was made, and whether its email is confirmed (Firebase Auth). */
async function accountOf(uid) {
  const auth = await (await import("./games-admin.mjs")).firebaseAuth();
  const user = await auth.getUser(uid);
  return {
    created: new Date(user.metadata.creationTime),
    verified: user.emailVerified === true,
  };
}

const send = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};

/**
 * The writes for a friend joining, as one transaction over their referral
 * record, their rewards and the inviter's: all three, or (`undefined`)
 * nothing when the friend is already recorded. Pure, so a transaction that
 * runs it again on a retry decides afresh.
 */
export const joinWrites =
  (challengeId, challenge, now) =>
  ([referral, friend, inviter]) => {
    if (referral) return [undefined, undefined, undefined];
    const joined = inviterJoined(inviter, now);
    return [
      {
        referrer: challenge.uid,
        challenge: challengeId,
        game: challenge.game,
        joinedAt: now,
        joinDay: day(now),
        returnedAt: null,
        paidReferrer: joined.paid,
      },
      pay(friend, JOIN_COINS),
      joined.doc,
    ];
  };

/**
 * The writes for a friend's round on a later day: the referral marked
 * returned and the inviter's coins together, once; nothing (`undefined`)
 * before then or after it is paid. Pure, like joinWrites.
 */
export const returnWrites =
  (now) =>
  ([referral, inviter]) =>
    !referral || referral.returnedAt || day(now) === referral.joinDay
      ? [undefined, undefined]
      : [{ ...referral, returnedAt: now }, pay(inviter, RETURN_COINS)];

/** A friend's first claim: records them and pays both, or says why not. */
async function join(claims, challengeId, account, now) {
  const uid = claims.uid;
  if (typeof challengeId !== "string" || !CHALLENGE_ID.test(challengeId))
    return { state: "none" };
  // A test account (scripts/test-accounts.mjs) is never a friend brought.
  if (hasRole(claims, "tester")) return { state: "none" };
  const challenge = await getDoc("challenges", challengeId);
  // Only a signed-in player's challenge can bring a friend, never their own,
  // and never a test account's.
  if (!challenge?.uid || challenge.uid === uid || challenge.test === true)
    return { state: "none" };
  const { created: made, verified } = await account(uid);
  const age = Date.parse(now) - made.getTime();
  // A new account with a real address: made after the challenge, recently,
  // and its email confirmed.
  if (
    !verified ||
    !(made.getTime() >= Date.parse(challenge.createdAt)) ||
    age > NEW_ACCOUNT_DAYS * 86_400_000
  )
    return { state: "none" };
  // The record and both payments are saved together, or not at all, and
  // a friend already recorded (by another request, even at the same time)
  // is never paid twice.
  const [saved] = await updateMany(
    [
      ["referrals", uid],
      ["rewards", uid],
      ["rewards", challenge.uid],
    ],
    joinWrites(challengeId, challenge, now),
  );
  if (!saved) return { state: "waiting" };
  console.log("referral", challenge.uid, uid, challenge.game);
  return { state: "joined", coins: JOIN_COINS };
}

/** A friend's round on a later day: the inviter's second payment, once. */
async function comeBack(uid, referral, now) {
  if (referral.returnedAt) return { state: "returned" };
  if (day(now) === referral.joinDay) return { state: "waiting" };
  await updateMany(
    [
      ["referrals", uid],
      ["rewards", referral.referrer],
    ],
    returnWrites(now),
  );
  return { state: "returned" };
}

export async function handleReferrals(
  req,
  res,
  pathname,
  {
    verify,
    exchange = refresh,
    account = accountOf,
    now = () => new Date().toISOString(),
  } = {},
) {
  try {
    if (req.method !== "POST") throw new ApiError(405, "method-not-allowed");
    validateOrigin(req);
    throttle(req);
    const body = await readBody(req);
    const claims = await signedInClaims(req, res, verify, exchange);
    const at = now();
    const referral = await getDoc("referrals", claims.uid);
    return send(
      res,
      200,
      referral
        ? await comeBack(claims.uid, referral, at)
        : await join(claims, body.challenge, account, at),
    );
  } catch (error) {
    if (error instanceof ApiError)
      return send(res, error.status, { error: error.message });
    console.error("referrals", error);
    send(res, 503, { error: "unavailable" });
  }
}
