"use client";
// The developer playground: runs a game from any address (usually the
// developer's own computer) the way /play/<id>/ does, with a test player
// instead of the real account. Every SDK call is answered by the same
// bridge as real games (src/lib/game-bridge) and shown in a log.
import { LOCALES } from "@/lib/i18n";
import type { Challenge } from "@/data/challenge.mjs";
import { createChallengeLink } from "@/lib/challenges";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "./locale";
import { SANDBOX, type PublishedGame } from "./game-host";
import {
  BridgeError,
  handleGameRequest,
  isGameRequest,
  PROTOCOL,
  type BridgeContext,
  type GameRequest,
  type Player,
} from "@/lib/game-bridge";
import type { Locale } from "@/lib/i18n";

const ADDRESS_KEY = "dingn.playground.address";
const DEFAULT_ADDRESS = "http://localhost:5173/";
const MAX_LOG = 50;

type LogEntry = { n: number; call: string; result: string; ok: boolean };

/** The address as a URL a frame may load, or null. */
export function gameAddress(text: string): string | null {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const short = (value: unknown) => {
  const json = JSON.stringify(value);
  if (json === undefined) return "";
  return json.length > 120 ? json.slice(0, 117) + "…" : json;
};
function describe(request: GameRequest) {
  const params = request.params;
  const args =
    params && Object.keys(params).length
      ? Object.values(params).map(short).join(", ")
      : "";
  return `${request.method}(${args})`;
}

function readSaved() {
  try {
    return localStorage.getItem(ADDRESS_KEY);
  } catch {
    return null;
  }
}

/** A share link opens the live game, so only that build can create it here. */
async function liveGameId(address: string): Promise<string> {
  const game = new URL(address);
  const id = /^\/g\/([a-z][a-z0-9]{1,30})\//.exec(game.pathname)?.[1];
  const unpublished = () =>
    new BridgeError(
      "unpublished_game",
      "Challenge links require the live dingn build of this game.",
    );
  if (!id || game.origin !== location.origin) throw unpublished();
  const response = await fetch(`/api/games/${id}`);
  if (response.status === 404) throw unpublished();
  if (!response.ok) throw new Error("dingn could not look up the game.");
  const published: PublishedGame = await response.json();
  if (
    published.id !== id ||
    published.preview ||
    published.url !== game.pathname
  )
    throw unpublished();
  return id;
}

export function DevPlayground() {
  const { t, locale: siteLocale, href } = useLocale();
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [problem, setProblem] = useState("");
  const [url, setUrl] = useState("");
  // Changing the frame's key reloads the game.
  const [run, setRun] = useState(0);
  const [locale, setGameLocale] = useState<Locale>(siteLocale);
  const [signedIn, setSignedIn] = useState(false);
  const [tester, setTester] = useState(false);
  const [name, setName] = useState("Test player");
  const [ready, setReady] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastChallenge, setLastChallenge] = useState<Challenge | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const counter = useRef(0);
  // The test player's saved data. It lasts until this page closes.
  const storage = useRef(new Map<string, string>());
  const bought = useRef(new Set<string>());
  const badges = useRef(new Set<string>());
  const progress = useRef<string | null>(null);

  useEffect(() => {
    const saved = readSaved();
    if (saved) setAddress(saved);
  }, []);

  const add = (call: string, result: string, ok = true) =>
    setLog((entries) =>
      [{ n: ++counter.current, call, result, ok }, ...entries].slice(
        0,
        MAX_LOG,
      ),
    );

  function load(event?: React.FormEvent) {
    event?.preventDefault();
    const next = gameAddress(address);
    if (!next) {
      setProblem(
        t("Enter a web address that starts with http:// or https://."),
      );
      return;
    }
    setProblem("");
    try {
      localStorage.setItem(ADDRESS_KEY, address.trim());
    } catch {}
    if (next !== url) {
      setLastChallenge(null);
      setChallenge(null);
    }
    setUrl(next);
    reload();
  }
  function reload() {
    setReady(false);
    setLog([]);
    setRun((n) => n + 1);
  }
  function clearData() {
    storage.current.clear();
    badges.current.clear();
    progress.current = null;
    setLastChallenge(null);
    setChallenge(null);
    reload();
  }

  const player: Player = {
    signedIn,
    name: signedIn ? name : "",
    avatar: "",
    tester: signedIn && tester,
  };
  const context = useRef<BridgeContext | null>(null);
  context.current = {
    gameId: "playground",
    version: "dev",
    locale,
    player,
    storage: {
      getItem: (key) => storage.current.get(key) ?? null,
      setItem: (key, value) => void storage.current.set(key, value),
    },
    loadProgress: async () => progress.current,
    saveProgress: async (json) => {
      progress.current = json;
    },
    signIn: () => setSignedIn(true),
    navigate: () => {},
    ready: () => setReady(true),
    challenge,
    challengeLink: async (round) => {
      setLastChallenge(round);
      return createChallengeLink(await liveGameId(url), round, locale);
    },
    // Compare against the replayed round without writing to dingn.
    challengeResult: challenge
      ? async (score) => {
          const beat = score > challenge.score;
          return {
            beat,
            posted: false,
            best: score,
            rank: signedIn ? (beat ? 1 : 2) : null,
            players: signedIn ? 2 : 1,
            test: true,
          };
        }
      : undefined,
    // The playground has no game.json, so any badge id unlocks once and any
    // item can be bought, as tests that pay, charge and save nothing.
    rewards: {
      unlock: async (id) => {
        const first = !badges.current.has(id);
        badges.current.add(id);
        return { new: first, coins: 0, test: true };
      },
      list: async () =>
        [...badges.current].map((id) => ({
          id,
          tier: "bronze",
          coins: 0,
          title: id,
          earned: true,
        })),
      spend: async (id) => {
        const first = !bought.current.has(id);
        bought.current.add(id);
        return { new: first, coins: 0, test: true };
      },
      shop: async () =>
        [...bought.current].map((id) => ({
          id,
          price: 0,
          title: id,
          owned: true,
        })),
      earn: async (coins) => ({ coins, left: null, test: true }),
    },
  };

  useEffect(() => {
    if (!url) return;
    function onMessage(event: MessageEvent) {
      const target = frame.current?.contentWindow;
      if (!target || event.source !== target || !isGameRequest(event.data))
        return;
      const request = event.data;
      const ctx = context.current;
      if (!ctx) return;
      void handleGameRequest(request, ctx).then((reply) => {
        if (reply) target.postMessage(reply, "*");
        if (reply && "error" in reply)
          add(
            describe(request),
            `${reply.error.code}: ${reply.error.message}`,
            false,
          );
        else if (reply) add(describe(request), short(reply.result));
        else add(describe(request), "");
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [url, run]);

  // Tell the game when the test player signs in or out.
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

  return (
    <div className="container dev-page">
      <p className="eyebrow">{t("FOR GAME DEVELOPERS")}</p>
      <h1>{t("Game playground")}</h1>
      <p>
        {t(
          "Test your game with a simulated player. Only a live dingn build can create a real challenge link.",
        )}{" "}
        <Link href={href("/developers/")}>{t("Read the developer guide")}</Link>
      </p>

      <form className="dev-load" onSubmit={load}>
        <label htmlFor="dev-address">{t("Game address")}</label>
        <div className="dev-load-row">
          <input
            id="dev-address"
            type="text"
            inputMode="url"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className="button">
            {t("Load")}
          </button>
        </div>
        {problem && (
          <p className="dev-problem" role="alert">
            {problem}
          </p>
        )}
        <p className="dev-hint">
          {t(
            "Serve your game with CORS (for example npx serve --cors -l 5173), over https or from localhost. Chrome may ask to allow access to your local network.",
          )}
        </p>
      </form>

      <div className="dev-controls">
        <label>
          {t("Language")}{" "}
          <select
            value={locale}
            onChange={(event) => {
              setGameLocale(event.target.value as Locale);
              if (url) reload();
            }}
          >
            {LOCALES.map((l) => (
              <option key={l.lang} value={l.lang} lang={l.lang}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={signedIn}
            onChange={(event) => setSignedIn(event.target.checked)}
          />{" "}
          {t("Test player signed in")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={tester}
            disabled={!signedIn}
            onChange={(event) => setTester(event.target.checked)}
          />{" "}
          {t("As a test account")}
        </label>
        <label>
          {t("Player name")}{" "}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
          />
        </label>
        <button type="button" disabled={!url} onClick={reload}>
          {t("Reload game")}
        </button>
        <button
          type="button"
          disabled={!lastChallenge}
          onClick={() => {
            setChallenge(lastChallenge);
            reload();
          }}
        >
          {t("Replay last challenge")}
        </button>
        {challenge && (
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              reload();
            }}
          >
            {t("Exit challenge")}
          </button>
        )}
        <button type="button" disabled={!url} onClick={clearData}>
          {t("Clear saved data")}
        </button>
      </div>

      {url ? (
        <div className="dev-stage">
          <p className="dev-status" role="status">
            {ready
              ? t("The game called ready().")
              : t("Waiting for the game to call ready()…")}
          </p>
          <iframe
            key={`${url}#${run}`}
            ref={frame}
            src={url}
            title={t("Your game")}
            sandbox={SANDBOX}
            allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope; clipboard-write; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="dev-empty">
          {t("Enter your game's address and press Load.")}
        </p>
      )}

      <section className="dev-log" aria-labelledby="dev-log-title">
        <h2 id="dev-log-title">{t("SDK calls")}</h2>
        {log.length === 0 ? (
          <p>{t("No calls yet.")}</p>
        ) : (
          <ol reversed>
            {log.map((entry) => (
              <li key={entry.n} className={entry.ok ? "" : "dev-log-error"}>
                <code>{entry.call}</code>
                {entry.result && (
                  <>
                    {" "}
                    → <code>{entry.result}</code>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
