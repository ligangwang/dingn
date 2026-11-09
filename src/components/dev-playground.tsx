"use client";
// The developer playground: runs a game from any address (usually the
// developer's own computer) the way /play/<id>/ does, with a test player
// instead of the real account. Every SDK call is answered by the same
// bridge as real games (src/lib/game-bridge) and shown in a log.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "./locale";
import { SANDBOX } from "./game-host";
import {
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

export function DevPlayground() {
  const { t, locale: siteLocale, href } = useLocale();
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [problem, setProblem] = useState("");
  const [url, setUrl] = useState("");
  // Changing the frame's key reloads the game.
  const [run, setRun] = useState(0);
  const [locale, setGameLocale] = useState<Locale>(siteLocale);
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState("Test player");
  const [ready, setReady] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);
  const counter = useRef(0);
  // The test player's saved data. It lasts until this page closes.
  const storage = useRef(new Map<string, string>());
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
    reload();
  }

  const player: Player = {
    signedIn,
    name: signedIn ? name : "",
    avatar: "",
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
    // The playground has no game.json, so any badge id unlocks once, as a
    // test that pays nothing and saves nothing.
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
          "Run your game inside dingn while you build it. The playground answers every SDK call like a real game page, with a test player instead of your account. Nothing is saved to dingn.",
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
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
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
            allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope"
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
