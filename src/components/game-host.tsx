"use client";
// Plays a game published on the dingn game platform. The page is the same for
// every game: it asks the registry which version is live, runs that version in
// a sandboxed frame, and answers the game's SDK requests (src/lib/game-bridge).
import { pick, stripLocale } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import { GameAbout } from "./game-about";
import { ServerFill } from "./server-fill";
import type { Category } from "@/lib/catalog";
import { useOptionalSession } from "./session";
import { database, doc, getDoc, setDoc } from "@/lib/database";
import {
  countPlay,
  reportGame,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/game-reports";
import {
  addToWallet,
  loadWallet,
  MERGE_TOAST_MS,
  mergeToasts,
  spendCoins,
  spendFromWallet,
  unlockBadge,
  earnCoins,
  earnToWallet,
  type BadgeDef,
  type EarnedToast,
  type ShopDef,
} from "@/lib/rewards";
import {
  BadgeToast,
  CoinToast,
  GameBadges,
  SpendConfirm,
  type SpendAsk,
} from "./rewards";
import {
  gameLocale,
  accountProgress,
  BridgeError,
  gameHash,
  handleGameRequest,
  isGameRequest,
  progressField,
  PROTOCOL,
  type BridgeContext,
  type Player,
} from "@/lib/game-bridge";
import {
  CHALLENGE_ID,
  challengeIdFromQuery,
  challengeText,
  challengeUrl,
  validChallenge,
  type Challenge,
} from "@/data/challenge.mjs";
import { api } from "@/lib/api";
import { madeHere, rememberChallenge } from "@/lib/my-challenges";
import {
  closeChallenge,
  deleteChallenge,
  fetchThread,
  keepPendingResult,
  postChallengeResult,
  takePendingResult,
  threadOf,
  type Thread,
} from "@/lib/challenges";
import { roundText, scoreText } from "@/data/challenge.mjs";
import { ChallengeResults, ShareChallenge } from "./challenge-card";
import { claimReferral, noteArrival, referralOpen } from "@/lib/referral";
import { trackGame } from "@/lib/funnel";

export type PublishedGame = {
  id: string;
  version: string;
  title: { en: string; zh: string } & Record<string, string | undefined>;
  description: { en: string; zh: string } & Record<string, string | undefined>;
  entry: string;
  url: string;
  /** An outside developer's upload that dingn has not reviewed yet. */
  preview?: boolean;
  /** The badges this version can award (scripts/rewards.mjs). */
  badges?: BadgeDef[];
  /** The upgrades this version sells for coins. */
  shop?: ShopDef[];
  /** Where the catalog lists it. */
  category?: Category;
  /** The languages the game speaks (game.json); English and Chinese if unlisted. */
  languages?: string[];
};

/** The bridge error for a failed purchase (codes from scripts/rewards.mjs). */
function spendError(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "not-enough-coins")
    return new BridgeError("not_enough_coins", "Not enough coins.");
  if (code === "requires")
    return new BridgeError(
      "requires",
      "Buy the upgrade before this one first.",
    );
  if (code === "unknown-item")
    return new BridgeError(
      "invalid",
      "That item is not in this version's game.json shop.",
    );
  if (code === "sign-in-required" || code === "invalid-credential")
    return new BridgeError("signed_out", "Sign in to spend coins.");
  if (code === "too-many-requests")
    return new BridgeError("too_many", "Too many requests. Try later.");
  return new BridgeError("unavailable", "The shop is unavailable right now.");
}

/** The bridge error for failed coin earnings (codes from scripts/rewards.mjs). */
function earnError(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "sign-in-required" || code === "invalid-credential")
    return new BridgeError("signed_out", "Sign in to earn coins.");
  if (code === "too-many-requests")
    return new BridgeError("too_many", "Too many requests. Try later.");
  return new BridgeError("unavailable", "Coins are unavailable right now.");
}

/** The bridge error for a failed badge unlock (codes from scripts/rewards.mjs). */
function rewardError(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "sign-in-required" || code === "invalid-credential")
    return new BridgeError("signed_out", "Sign in to earn badges.");
  if (code === "unknown-badge")
    return new BridgeError(
      "invalid",
      "That badge is not in this version's game.json.",
    );
  if (code === "too-many-requests")
    return new BridgeError("too_many", "Too many badges at once. Try later.");
  return new BridgeError("unavailable", "Badges are unavailable right now.");
}

/** The game id in /play/<id>/, or the same under a language's prefix (/es/play/<id>/). */
export function gameIdFromPath(pathname: string) {
  return (
    /^\/play\/([a-z][a-z0-9]{1,30})\/?$/.exec(stripLocale(pathname))?.[1] ?? ""
  );
}

// What a sandboxed frame may do. It has no allow-same-origin, so the game runs
// in its own opaque origin, cut off from the website's cookies and storage.
export const SANDBOX =
  "allow-scripts allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-forms";

/** Plays the game in the URL (/play/<id>/), or `gameId` on a game's own page. */
export function GameHost({ gameId }: { gameId?: string } = {}) {
  const { locale, t, href } = useLocale();
  const session = useOptionalSession();
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<
    | { status: "loading" | "missing" | "error" }
    | { status: "ready"; game: PublishedGame; pinned: string }
  >({ status: "loading" });
  const [loaded, setLoaded] = useState(false);
  // A friend's saved challenge, from the id in the address (?c=…), read once.
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  // The nickname of the player who made it, or null for "A friend".
  const [challenger, setChallenger] = useState<string | null>(null);
  // Its id, and the results posted under it, highest first.
  const challengeId = useRef<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  // How this player's round of it ended, once the game reports it.
  const [outcome, setOutcome] = useState<{
    score: number;
    beat: boolean;
    posted: boolean;
    rank: number | null;
    players: number;
  } | null>(null);
  // The player challenged a level that already had a challenge: where their
  // score stands under it.
  const [joined, setJoined] = useState<{
    challenge: Challenge;
    rank: number | null;
    players: number;
  } | null>(null);
  const lastRound = useRef(0);
  const referralAsked = useRef(false);
  // A visitor without an account who came through a friend's challenge,
  // after their first finished round: the invitation to sign up.
  const [invite, setInvite] = useState<"hidden" | "shown" | "dismissed">(
    "hidden",
  );
  /** The sign-up page, in create-account mode, coming back to this game. */
  const signUpHref = () =>
    `${href("/signin/")}?create=1&next=${encodeURIComponent(location.pathname + location.search)}`;
  const stage = useRef<HTMLDivElement>(null);
  // Full screen: the browser's own where it works, otherwise (iPhone Safari,
  // or a request the browser refuses) the stage simply fills the window.
  const [full, setFull] = useState<"" | "native" | "window">("");
  useEffect(() => {
    const sync = () => {
      const el =
        document.fullscreenElement ??
        (document as { webkitFullscreenElement?: Element })
          .webkitFullscreenElement;
      setFull((f) =>
        el && el === stage.current ? "native" : f === "native" ? "" : f,
      );
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);
  useEffect(() => {
    if (full !== "window") return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setFull("");
    document.addEventListener("keydown", key);
    document.documentElement.classList.add("play-window-full");
    return () => {
      document.removeEventListener("keydown", key);
      document.documentElement.classList.remove("play-window-full");
    };
  }, [full]);
  async function enterFullscreen() {
    const el = stage.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> })
      | null;
    if (!el) return;
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    try {
      if (!request) throw new Error("unsupported");
      await request.call(el);
      setFull("native");
    } catch {
      setFull("window");
    }
    // Give the keyboard back to the game.
    frame.current?.focus();
  }
  function exitFullscreen() {
    if (full === "native") {
      const d = document as Document & { webkitExitFullscreen?: () => void };
      if (document.exitFullscreen)
        void document.exitFullscreen().catch(() => {});
      else d.webkitExitFullscreen?.();
    }
    setFull("");
  }
  const [toast, setToast] = useState<EarnedToast | null>(null);
  const toasts = useRef<EarnedToast[]>([]);
  const toastKey = useRef(0);
  // "+3 coins" when a game pays for play; quick payouts add up in one.
  const [coinToast, setCoinToast] = useState<{
    key: number;
    coins: number;
    test: boolean;
  } | null>(null);
  // When a game awards several badges at once (a returning player catching
  // up on past levels), they share one popup instead of a popup each.
  const toastShownAt = useRef(0);
  // The "Spend coins?" question a game's rewards.spend() is waiting on.
  const [ask, setAsk] = useState<SpendAsk | null>(null);
  const asking = useRef(false);
  // Upgrades "bought" in an unreviewed version during this visit.
  const tried = useRef(new Set<string>());
  function confirmSpend(item: ShopDef, balance: number) {
    // One question at a time: a second purchase while one is open is a no.
    if (asking.current) return Promise.resolve(false);
    asking.current = true;
    return new Promise<boolean>((resolve) =>
      setAsk({
        item,
        balance,
        answer: (yes) => {
          asking.current = false;
          setAsk(null);
          resolve(yes);
        },
      }),
    );
  }
  function showToast(next: EarnedToast) {
    const queued = toasts.current;
    if (queued.length) {
      queued[queued.length - 1] = mergeToasts(queued[queued.length - 1], next);
      return;
    }
    setToast((shown) => {
      if (!shown) {
        toastShownAt.current = Date.now();
        return next;
      }
      if (Date.now() - toastShownAt.current < MERGE_TOAST_MS) {
        toastShownAt.current = Date.now();
        return mergeToasts(shown, next);
      }
      queued.push(next);
      return shown;
    });
  }
  function nextToast() {
    toastShownAt.current = Date.now();
    setToast(toasts.current.shift() ?? null);
  }

  useEffect(() => {
    const id = gameId ?? gameIdFromPath(location.pathname);
    const requested = new URLSearchParams(location.search).get("v") ?? "";
    if (!id) return setState({ status: "missing" });
    let active = true;
    // Looked up alongside the game and given to it at start, so the game
    // never starts without the challenge it was opened for. A link that
    // can't be read just opens the game.
    const cid = challengeIdFromQuery(location.search);
    // A visitor who joins dingn from a friend's challenge earns them both coins.
    if (cid) noteArrival(cid);
    const saved: Promise<{
      c: Challenge;
      name: string | null;
      thread: Thread | null;
      id: string;
    } | null> = cid
      ? fetch(`/api/challenges/${cid}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((found) => {
            const c = found?.game === id ? validChallenge(found) : null;
            const name = typeof found?.name === "string" ? found.name : null;
            // The player's own link (by their account, or made in this
            // browser): their own score to beat.
            const mine = found?.mine === true || madeHere(cid);
            const at =
              typeof found?.id === "string" && CHALLENGE_ID.test(found.id)
                ? (found.id as string)
                : cid;
            return (
              c && { c: { ...c, mine }, name, thread: threadOf(found), id: at }
            );
          })
          .catch(() => null)
      : Promise.resolve(null);
    fetch(
      `/api/games/${id}${requested ? `?v=${encodeURIComponent(requested)}` : ""}`,
    )
      .then(async (response) => {
        if (!active) return;
        if (response.status === 404) return setState({ status: "missing" });
        if (!response.ok) throw new Error("unavailable");
        const [game, friend] = await Promise.all([response.json(), saved]);
        if (!active) return;
        setChallenge(friend?.c ?? null);
        setChallenger(friend?.name ?? null);
        // (The id dingn answered with: a challenge merged into its level's
        // one opens that one.)
        challengeId.current = friend ? friend.id : null;
        setThread(friend?.thread ?? null);
        setState({
          status: "ready",
          game,
          pinned: requested,
        });
      })
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, []);

  const game = state.status === "ready" ? state.game : null;
  const title = game ? pick(game.title, locale) : "";
  const uid = session?.user?.uid ?? null;
  /** Posts the signed-in player's score under the challenge and shows the thread again. */
  async function postResult(cid: string, score: number) {
    let posted;
    try {
      posted = await postChallengeResult(cid, score);
    } catch {
      throw new BridgeError(
        "unavailable",
        "dingn could not post that result right now.",
      );
    }
    const { test, improved: _improved, ...result } = posted;
    setOutcome({ score, ...result, posted: !test });
    if (!test) void fetchThread(cid).then((next) => next && setThread(next));
    return { ...result, posted: !test, ...(test ? { test } : {}) };
  }
  /** The maker closes their challenge, or deletes it and stays on the game. */
  async function endChallenge(how: "close" | "delete") {
    const cid = challengeId.current;
    if (!cid) return;
    if (
      how === "delete" &&
      !window.confirm(t("Delete this challenge? Its link will stop working."))
    )
      return;
    try {
      if (how === "close") {
        await closeChallenge(cid);
        setThread((was) => was && { ...was, closed: true });
      } else {
        await deleteChallenge(cid);
        // The game page itself, without the challenge that is gone.
        location.href = location.pathname;
      }
    } catch {
      // Nothing changed: the buttons stay for another try.
    }
  }
  const gameReady = !!game && loaded;
  useEffect(() => {
    // A signed-in player who arrived through someone's challenge: the coins
    // for both of them are claimed as soon as a game is open, once per page.
    // Nothing waits on the game (not every game says when a round ends); the
    // server decides whether the account counts (scripts/referrals.mjs).
    if (!uid || !gameReady || referralAsked.current) return;
    referralAsked.current = true;
    void claimReferral().then((result) => {
      if (result?.state !== "joined" || !result.coins) return;
      const coins = result.coins;
      earnToWallet(uid, { coins, balance: null, left: null });
      setCoinToast((shown) => ({
        key: ++toastKey.current,
        coins: (shown?.coins ?? 0) + coins,
        test: false,
      }));
    });
  }, [uid, gameReady]);
  useEffect(() => {
    // Back from signing in: the round finished before is posted now.
    const cid = challengeId.current;
    if (!uid || !cid || !challenge) return;
    const score = takePendingResult(cid);
    if (score != null) void postResult(cid, score).catch(() => {});
  }, [uid, challenge]);
  useEffect(() => {
    // As the server titles the page (gameTitle in scripts/game-seo.mjs).
    if (title) document.title = `${t(`${title} – Play free online`)} · dingn`;
  }, [title]);

  const user = session?.user ?? null;
  const player: Player = {
    signedIn: !!user,
    name: session?.profile.userName || user?.displayName || "",
    avatar: user?.photoURL || "",
    tester: user?.isTester === true,
  };
  // A test account's play stays out of the statistics.
  const counted = !session?.user?.isTester;
  // The bridge reads the latest values through a ref, so the message listener
  // is attached once per game.
  const context = useRef<BridgeContext | null>(null);
  context.current = game && {
    gameId: game.id,
    version: game.version,
    locale: gameLocale(locale, game.languages),
    player,
    storage: (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })(),
    loadProgress: async () => {
      if (!user) return null;
      const data = (await getDoc(doc(database, "accounts", user.uid))).data();
      return accountProgress(game.id, data);
    },
    saveProgress: async (json) => {
      if (!user) throw new Error("signed_out");
      await setDoc(
        doc(database, "accounts", user.uid),
        { [progressField(game.id)]: json },
        { merge: true },
      );
    },
    navigate: (path) => {
      // The bridge already checked the path; check the final URL again so a
      // game can never send the player to another site.
      const target = new URL(href(path), location.origin);
      if (target.origin === location.origin) location.href = target.href;
    },
    signIn: () => {
      location.href = `${href("/signin/")}?next=${encodeURIComponent(location.pathname + location.search)}`;
    },
    ready: () => setLoaded(true),
    challenge,
    challengeLink: async (c) => {
      const made = await api<{
        id: string;
        joined?: boolean;
        owner?: boolean;
        rank?: number | null;
        players?: number;
      }>("/api/challenges", { game: game.id, ...c });
      // A level has one challenge: when it already had one, the player's
      // score went under it, and they are told their place there.
      if (made.joined)
        setJoined({
          challenge: c,
          rank: made.rank ?? null,
          players: made.players ?? 1,
        });
      else setJoined(null);
      // Theirs to open as their own: one they made, or own already.
      if (!made.joined || made.owner) rememberChallenge(made.id);
      if (counted) trackGame("share", game.id);
      return challengeUrl(location.origin, game.id, made.id, locale);
    },
    challengeResult: async (score) => {
      const cid = challengeId.current;
      if (!cid || !challenge)
        throw new BridgeError(
          "no_challenge",
          "This page was not opened from a challenge.",
        );
      const beat = score > challenge.score;
      // A closed challenge can still be played, but takes no more results.
      if (!user || thread?.closed) {
        // Kept while they sign in, and posted when they come back.
        if (!thread?.closed) keepPendingResult(cid, score);
        const players = thread?.players ?? 1;
        setOutcome({ score, beat, posted: false, rank: null, players });
        return { beat, posted: false, best: score, rank: null, players };
      }
      return postResult(cid, score);
    },
    roundEnded: () => {
      // A few seconds apart at most, so a game calling it in a loop can't
      // flood the statistics.
      if (Date.now() - lastRound.current < 3000) return;
      lastRound.current = Date.now();
      if (counted) trackGame("finish", game.id);
      if (!user && referralOpen())
        setInvite((was) => (was === "hidden" ? "shown" : was));
    },
    rewards: {
      unlock: async (id) => {
        const def = game.badges?.find((b) => b.id === id);
        if (!def)
          throw new BridgeError(
            "invalid",
            "That badge is not in this version's game.json.",
          );
        let result;
        try {
          result = await unlockBadge(game.id, game.version, id);
        } catch (error) {
          throw rewardError(error);
        }
        if (result.new) {
          if (user) addToWallet(user.uid, game.id, result, def);
          showToast({
            key: ++toastKey.current,
            count: 1,
            badge: def,
            coins: result.coins,
            test: !!result.test,
          });
        }
        return {
          new: result.new,
          coins: result.coins,
          ...(result.test ? { test: true } : {}),
        };
      },
      spend: async (id) => {
        const def = game.shop?.find((i) => i.id === id);
        if (!def)
          throw new BridgeError(
            "invalid",
            "That item is not in this version's game.json shop.",
          );
        const wallet = user ? await loadWallet(user.uid) : null;
        if (!user || !wallet)
          throw new BridgeError(
            "unavailable",
            "The shop is unavailable right now.",
          );
        const owns = (item: string) =>
          tried.current.has(item) ||
          wallet.items.some((i) => i.game === game.id && i.id === item);
        if (owns(id)) return { new: false, coins: 0 };
        if (def.requires && !owns(def.requires))
          throw new BridgeError(
            "requires",
            "Buy the upgrade before this one first.",
          );
        // An unreviewed version only pretends, so it may ask with any balance.
        if (!game.preview && wallet.coins < def.price)
          throw new BridgeError(
            "not_enough_coins",
            "Not enough coins.",
            wallet.coins,
          );
        if (!(await confirmSpend(def, wallet.coins)))
          throw new BridgeError("cancelled", "The player did not buy it.");
        let result;
        try {
          result = await spendCoins(game.id, game.version, id);
        } catch (error) {
          const failure = spendError(error);
          if (failure.code !== "not_enough_coins") throw failure;
          // The cached wallet could afford it, so coins were spent elsewhere
          // meanwhile: send the server's newer balance, or none.
          const fresh = await loadWallet(user.uid, true);
          throw new BridgeError(
            failure.code,
            failure.message,
            fresh && fresh.coins < def.price ? fresh.coins : undefined,
          );
        }
        // An unreviewed version's purchases are only pretend, but remembered
        // for this visit so its developer can try every tier.
        if (result.test) tried.current.add(id);
        spendFromWallet(user.uid, game.id, result, def);
        return {
          new: result.new,
          coins: result.coins,
          ...(result.test ? { test: true } : {}),
        };
      },
      earn: async (coins) => {
        let result;
        try {
          result = await earnCoins(game.id, game.version, coins);
        } catch (error) {
          throw earnError(error);
        }
        if (user) earnToWallet(user.uid, result);
        if (result.coins > 0)
          setCoinToast((shown) => ({
            key: ++toastKey.current,
            coins: (shown?.coins ?? 0) + result.coins,
            test: !!result.test,
          }));
        return {
          coins: result.coins,
          left: result.left,
          ...(result.test ? { test: true } : {}),
        };
      },
      shop: async () => {
        const wallet = user ? await loadWallet(user.uid) : null;
        return (game.shop ?? []).map((i) => ({
          id: i.id,
          price: i.price,
          ...(i.requires ? { requires: i.requires } : {}),
          title: pick(i.title, locale),
          owned:
            tried.current.has(i.id) ||
            !!wallet?.items.some((o) => o.game === game.id && o.id === i.id),
        }));
      },
      list: async () => {
        const wallet = user ? await loadWallet(user.uid) : null;
        const earned = new Set(
          wallet?.badges.filter((b) => b.game === game.id).map((b) => b.id),
        );
        return (game.badges ?? []).map((b) => ({
          id: b.id,
          tier: b.tier,
          ...(b.level != null ? { level: b.level } : { icon: b.icon }),
          coins: b.coins,
          title: pick(b.title, locale),
          earned: earned.has(b.id),
        }));
      },
    },
  };

  useEffect(() => {
    if (!game) return;
    function onMessage(event: MessageEvent) {
      const target = frame.current?.contentWindow;
      // Only the game's own frame, which runs in an opaque ("null") origin.
      if (!target || event.source !== target || !isGameRequest(event.data))
        return;
      const ctx = context.current;
      if (!ctx) return;
      void handleGameRequest(event.data, ctx).then((reply) => {
        if (reply) target.postMessage(reply, "*");
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [game?.id, game?.version]);

  // Count one play each time a game opens, for its developer's stats, once
  // dingn knows who is playing: a test account's plays aren't counted.
  const known = !session || session.ready;
  useEffect(() => {
    if (!game || !known || !counted) return;
    countPlay(game.id, game.version);
    trackGame("start", game.id);
  }, [game?.id, game?.version, known]);

  // Tell the game when the player switches language, in the language it
  // shows (a game that doesn't speak the new one stays in English).
  const shown = game ? gameLocale(locale, game.languages) : "en";
  const firstLanguage = useRef(true);
  useEffect(() => {
    if (firstLanguage.current) {
      firstLanguage.current = false;
      return;
    }
    frame.current?.contentWindow?.postMessage(
      { dingn: "host", v: PROTOCOL, event: "language", data: shown },
      "*",
    );
  }, [shown]);

  // Tell the game when the player signs in or out.
  const playerKey = JSON.stringify(player);
  const firstPlayer = useRef(true);
  useEffect(() => {
    if (firstPlayer.current) {
      firstPlayer.current = false;
      return;
    }
    frame.current?.contentWindow?.postMessage(
      { dingn: "host", v: PROTOCOL, event: "player", data: player },
      "*",
    );
  }, [playerKey]);

  if (state.status === "loading")
    return (
      <div className="container play-page">
        <p className="play-status">{t("Loading game…")}</p>
        {/* The server describes the game here until it loads. */}
        <ServerFill name="game" className="game-about" />
      </div>
    );
  if (state.status !== "ready")
    return (
      <div className="container play-page">
        <h1>
          {state.status === "missing"
            ? t("Game not found")
            : t("This game is not available right now.")}
        </h1>
        <p>
          <Link href={href("/")}>{t("Find another game →")}</Link>
        </p>
      </div>
    );

  const testing = state.pinned
    ? state.pinned === "beta"
      ? t("Beta")
      : state.pinned
    : "";
  return (
    <div className="play-page play-ready">
      <div className="play-bar">
        <h1>{title}</h1>
        {testing && (
          <span className="play-version" title={state.game.version}>
            {testing} · {state.game.version}
          </span>
        )}
        <button
          type="button"
          className="play-fullscreen"
          // The stage, not just the frame, so badge popups show in full screen.
          onClick={() => void enterFullscreen()}
        >
          {t("Full screen")}
        </button>
      </div>
      {challenge && (
        <p className="play-challenge" role="note">
          <strong>
            {challengeText(challenge, title, locale, challenger, t).title}
          </strong>{" "}
          <span>
            {challenge.mine
              ? t("Play the same round again and beat your own score.")
              : t("You play the same round. Beat that score to win.")}
          </span>
          {!challenge.mine && !user && !outcome && (
            <span className="play-challenge-join">
              {t(
                "New to dingn? Sign up free from this challenge and you and your friend both get 100 coins.",
              )}{" "}
              <a href={signUpHref()}>{t("Create free account")}</a>
            </span>
          )}
        </p>
      )}
      {joined && (
        <p className="play-outcome joined" role="status">
          <strong>
            {(roundText(joined.challenge, t)
              ? t("{0} already has a challenge.")
              : t("This round already has a challenge.")
            ).replace("{0}", roundText(joined.challenge, t) ?? "")}
          </strong>{" "}
          <span>
            {joined.rank != null
              ? t("Your score is posted there: you are #{0} of {1}.")
                  .replace("{0}", String(joined.rank))
                  .replace("{1}", String(joined.players))
              : t("Your score is posted there.")}
          </span>
        </p>
      )}
      {challenge && outcome && (
        <p
          className={`play-outcome ${outcome.beat ? "won" : "lost"}`}
          role="status"
        >
          <strong>
            {(outcome.beat
              ? t("You beat it with {0}!")
              : t("You scored {0}. Not enough this time.")
            ).replace(
              "{0}",
              scoreText({ ...challenge, score: outcome.score }, locale, t),
            )}
          </strong>{" "}
          {outcome.posted && outcome.rank != null && (
            <span>
              {t("Your best is #{0} of {1} here.")
                .replace("{0}", String(outcome.rank))
                .replace("{1}", String(outcome.players))}
            </span>
          )}
          {!user && !thread?.closed && (
            <span>
              <a href={signUpHref()}>{t("Sign in to post your score")}</a>
            </span>
          )}
        </p>
      )}
      {/* Above the game, beside the score to beat, so the players already
          there are seen without scrolling; a few rows show, the rest scroll. */}
      {challenge && thread && thread.results.length > 0 && (
        <section className="play-thread" aria-label={t("Challenge results")}>
          <h2>{t("Challenge results")}</h2>
          {thread.closed && (
            <p className="play-thread-closed">
              {t("This challenge is closed. It takes no more results.")}
            </p>
          )}
          <ChallengeResults challenge={challenge} results={thread.results} />
          <p className="play-thread-actions">
            {challengeId.current && (
              <ShareChallenge game={state.game.id} id={challengeId.current} />
            )}
            {thread.owner && !thread.closed && (
              // Its maker can stop it taking results, or take it off dingn.
              <button
                type="button"
                className="quiet-link"
                onClick={() => void endChallenge("close")}
              >
                {t("Close challenge")}
              </button>
            )}
            {thread.owner && (
              <button
                type="button"
                className="quiet-link"
                onClick={() => void endChallenge("delete")}
              >
                {t("Delete challenge")}
              </button>
            )}
          </p>
        </section>
      )}
      {state.game.preview && (
        <p className="play-preview" role="note">
          {t(
            "Preview: an outside developer made this version, and dingn has not reviewed it yet. Never enter a password or payment details in a game.",
          )}
        </p>
      )}
      <div
        className={full === "window" ? "play-stage window-full" : "play-stage"}
        ref={stage}
      >
        {full && (
          <button
            type="button"
            className="play-exit-full"
            onClick={exitFullscreen}
            aria-label={t("Exit full screen")}
            title={t("Exit full screen")}
          >
            ✕
          </button>
        )}
        {!loaded && <p className="play-status">{t("Loading game…")}</p>}
        <iframe
          ref={frame}
          src={state.game.url + gameHash(location.hash)}
          title={title}
          sandbox={SANDBOX}
          allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope; clipboard-write; web-share"
          allowFullScreen
          onLoad={() => setTimeout(() => setLoaded(true), 4000)}
        />
        <BadgeToast toast={toast} gameTitle={title} onDone={nextToast} />
        <CoinToast toast={coinToast} onDone={() => setCoinToast(null)} />
        {ask && <SpendConfirm ask={ask} gameTitle={title} />}
      </div>
      {invite === "shown" && !user && (
        <div className="play-invite" role="note">
          <p>
            {t(
              "Nice round! Create a free dingn account and you and your friend both get 100 coins.",
            )}
          </p>
          <a className="button" href={signUpHref()}>
            {t("Create free account")}
          </a>
          <button
            type="button"
            className="quiet-link"
            onClick={() => setInvite("dismissed")}
          >
            {t("Not now")}
          </button>
        </div>
      )}
      <GameBadges game={state.game.id} badges={state.game.badges ?? []} />
      <GameAbout game={state.game} />
      <ReportGame game={state.game} signedIn={!!user} />
    </div>
  );
}

const REASON_TEXT: Record<ReportReason, string> = {
  broken: "It does not work",
  offensive: "It is offensive or not for children",
  unsafe: "It asks for personal details, or looks like a scam",
  copyright: "It copies someone else's game or work",
  other: "Something else",
};

/** Lets a player tell dingn about a problem with a game. */
function ReportGame({
  game,
  signedIn,
}: {
  game: PublishedGame;
  signedIn: boolean;
}) {
  const { t, href } = useLocale();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"" | "sending" | "sent" | "failed">("");

  if (status === "sent")
    return (
      <p className="play-report" role="status">
        {t("Thanks. dingn will look at this game.")}
      </p>
    );
  if (!open)
    return (
      <p className="play-report">
        <button
          type="button"
          className="link-button"
          onClick={() => setOpen(true)}
        >
          {t("Report a problem with this game")}
        </button>
      </p>
    );
  if (!signedIn)
    return (
      <p className="play-report">
        {t("Sign in to report a game.")}{" "}
        <Link
          href={`${href("/signin/")}?next=${encodeURIComponent(
            typeof location === "undefined"
              ? href(`/play/${game.id}/`)
              : location.pathname + location.search,
          )}`}
        >
          {t("Sign in")}
        </Link>
      </p>
    );

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) return;
    setStatus("sending");
    try {
      await reportGame({ id: game.id, version: game.version, reason, details });
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <form className="play-report play-report-form" onSubmit={send}>
      <fieldset>
        <legend>{t("What is wrong with this game?")}</legend>
        {REPORT_REASONS.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="report-reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
            />{" "}
            {t(REASON_TEXT[value])}
          </label>
        ))}
      </fieldset>
      <label htmlFor="report-details">{t("Details (optional)")}</label>
      <textarea
        id="report-details"
        value={details}
        maxLength={1000}
        rows={3}
        onChange={(event) => setDetails(event.target.value)}
      />
      {status === "failed" && (
        <p role="alert" className="error">
          {t("The report could not be sent. Try again.")}
        </p>
      )}
      <p>
        <button
          type="submit"
          className="button small"
          disabled={
            !reason ||
            (reason === "other" && !details.trim()) ||
            status === "sending"
          }
        >
          {t("Send report")}
        </button>{" "}
        <button
          type="button"
          className="secondary-button"
          onClick={() => setOpen(false)}
        >
          {t("Cancel")}
        </button>
      </p>
    </form>
  );
}
