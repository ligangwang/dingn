"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "./auth";
import { useSession } from "./session";
import {
  deck,
  friendlyError,
  shuffle,
  soundGuide,
  type NumberEntry,
  type WordEntry,
} from "@/lib/models";
import {
  randomWord,
  readFavorite,
  readNumber,
  readNumbers,
  readWord,
  saveFavorite,
  type Cursor,
} from "@/lib/repository";
type Mode = "word" | "number" | "card";
const titles = {
  word: "Word practice",
  number: "Number practice",
  card: "Playing cards",
};
export function Practice({ mode }: { mode: Mode }) {
  const [digits, setDigits] = useState(1);
  const { user, profile, profileError } = useSession();
  return (
    <AuthGate returnTo={`/${mode}/`}>
      <div className="practice-page container">
        <div className="practice-heading">
          <div>
            <Link className="back-link" href="/">
              ← All practices
            </Link>
            <h1>{titles[mode]}</h1>
            <p className="lede">
              {mode === "word"
                ? "Make a connection between a word and its number."
                : mode === "card"
                  ? "Give each card a memorable word or image."
                  : "Turn a number into an image you can remember."}
            </p>
          </div>
          <Link className="mode-link" href="/account/">
            {profile.cardSide === "TwoSides" ? "Recall mode" : "Training mode"}{" "}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {profileError && (
          <p role="alert" className="error">
            Your saved preferences couldn’t be loaded. {profileError}
          </p>
        )}
        {mode === "number" && (
          <div className="digit-tabs" role="group" aria-label="Number length">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                aria-pressed={digits === n}
                onClick={() => setDigits(n)}
              >
                {n} {n === 1 ? "digit" : "digits"}
              </button>
            ))}
          </div>
        )}
        <PracticeSession
          key={`${mode}-${digits}-${user?.uid}`}
          mode={mode}
          digits={digits}
        />
        <details className="mini-guide">
          <summary>Need a hint? Open the number–sound guide</summary>
          <div className="sound-grid">
            {soundGuide.map((sound, i) => (
              <div key={i}>
                <strong>{i}</strong>
                <span>{sound}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </AuthGate>
  );
}
function PracticeSession({ mode, digits }: { mode: Mode; digits: number }) {
  const { user, profile } = useSession();
  const [numbers, setNumbers] = useState<NumberEntry[]>([]),
    [words, setWords] = useState<WordEntry[]>([]);
  const [cards, setCards] = useState(deck),
    [index, setIndex] = useState(0);
  const [search, setSearch] = useState(""),
    [result, setResult] = useState<NumberEntry | WordEntry | null>(null),
    [searching, setSearching] = useState(false);
  const [cardNumber, setCardNumber] = useState<NumberEntry | null>(null);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revealed, setRevealed] = useState(false);
  const [favorite, setFavorite] = useState<string | null>(null),
    [favoriteLoading, setFavoriteLoading] = useState(false),
    [favoriteError, setFavoriteError] = useState(""),
    [saving, setSaving] = useState(false);
  const cursor = useRef<Cursor>(undefined),
    more = useRef(true),
    mounted = useRef(true),
    lock = useRef(false);
  const current = searching
    ? result
    : mode === "word"
      ? words[index]
      : mode === "card"
        ? cardNumber
        : numbers[index];
  const numberEntry = current && "words" in current ? current : null;
  const wordEntry = current && "definitions" in current ? current : null;
  useEffect(() => {
    mounted.current = true;
    void initial();
    return () => {
      mounted.current = false;
    }; /* session is remounted for each user, mode and digit filter */
  }, []);
  async function initial() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (mode === "word") {
        const item = await randomWord();
        if (mounted.current) {
          setWords(item ? [item] : []);
          if (!item) setNotice("No words are available yet.");
        }
      } else if (mode === "card") {
        const item = await readNumber(deck[0].number);
        if (mounted.current) setCardNumber(item);
      } else {
        const page = await readNumbers(digits);
        if (mounted.current) {
          setNumbers(page.items);
          cursor.current = page.cursor;
          more.current = page.more;
          if (!page.items.length)
            setNotice("No numbers are available at this length yet.");
        }
      }
    } catch (e) {
      if (mounted.current) setError(friendlyError(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    setFavorite(null);
    setFavoriteError("");
    setFavoriteLoading(!!user && !!numberEntry);
    if (user && numberEntry)
      readFavorite(user.uid, numberEntry.number)
        .then((value) => {
          if (active) setFavorite(value);
        })
        .catch((e) => {
          if (active) setFavoriteError(friendlyError(e));
        })
        .finally(() => {
          if (active) setFavoriteLoading(false);
        });
    return () => {
      active = false;
    };
  }, [user?.uid, numberEntry?.number]);
  async function next() {
    if (lock.current || saving) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setRevealed(false);
    try {
      if (mode === "card") {
        const item = await readNumber(cards[index + 1].number);
        if (mounted.current) {
          setCardNumber(item);
          setIndex(index + 1);
        }
      } else if (mode === "word") {
        if (index + 1 < words.length) setIndex(index + 1);
        else {
          const item = await randomWord();
          if (mounted.current) {
            if (item) {
              setWords([...words, item]);
              setIndex(index + 1);
            } else setNotice("No more words are available.");
          }
        }
      } else if (index + 1 < numbers.length) setIndex(index + 1);
      else {
        const page = await readNumbers(digits, cursor.current);
        if (mounted.current) {
          cursor.current = page.cursor;
          more.current = page.more;
          setNumbers([...numbers, ...page.items]);
          if (page.items.length) setIndex(index + 1);
          else setNotice("You’ve reached the end of this set.");
        }
      }
    } catch (e) {
      if (mounted.current) setError(friendlyError(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function previous() {
    if (lock.current || saving || index === 0) return;
    setError("");
    setNotice("");
    setRevealed(false);
    if (mode !== "card") {
      setIndex(index - 1);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const item = await readNumber(cards[index - 1].number);
      if (mounted.current) {
        setCardNumber(item);
        setIndex(index - 1);
      }
    } catch (e) {
      if (mounted.current) setError(friendlyError(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function searchFor(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || saving) return;
    const value = search.trim();
    if (!value) return;
    if (mode === "number" && !/^\d{1,4}$/.test(value)) {
      setError("Enter a number with 1 to 4 digits.");
      return;
    }
    if (value.includes("/")) {
      setError("Enter a single word or number.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setRevealed(false);
    try {
      const item =
        mode === "word" ? await readWord(value) : await readNumber(value);
      if (mounted.current) {
        setResult(item);
        setSearching(true);
        if (!item) setNotice(`No match for “${value}”. Try another search.`);
      }
    } catch (e) {
      if (mounted.current) setError(friendlyError(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function reorder(random: boolean) {
    if (lock.current || saving) return;
    const nextCards = random ? shuffle(deck) : deck;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const item = await readNumber(nextCards[0].number);
      if (mounted.current) {
        setCards(nextCards);
        setIndex(0);
        setCardNumber(item);
        setRevealed(false);
      }
    } catch (e) {
      if (mounted.current) setError(friendlyError(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function chooseFavorite(word: string) {
    if (!user || !numberEntry || saving || favoriteLoading) return;
    setSaving(true);
    setFavoriteError("");
    try {
      await saveFavorite(user.uid, numberEntry.number, word);
      if (mounted.current) setFavorite(word);
    } catch (e) {
      if (mounted.current) setFavoriteError(friendlyError(e));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  const hideAnswer = mode === "card" || profile.cardSide === "TwoSides";
  const showAnswer = !hideAnswer || revealed;
  return (
    <>
      <div className="practice-toolbar">
        {mode !== "card" ? (
          <form className="search-form" onSubmit={searchFor}>
            <label className="sr-only" htmlFor="practice-search">
              Search {mode === "word" ? "words" : "numbers"}
            </label>
            <input
              id="practice-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mode === "word" ? "Find a word…" : "Find a number…"}
              maxLength={mode === "word" ? 100 : 4}
              inputMode={mode === "word" ? "text" : "numeric"}
            />
            <button className="secondary-button" disabled={busy || saving}>
              Search
            </button>
            {searching && (
              <button
                type="button"
                className="text-button"
                disabled={busy || saving}
                onClick={() => {
                  setSearching(false);
                  setResult(null);
                  setSearch("");
                  setNotice("");
                  setError("");
                  setRevealed(false);
                }}
              >
                Back to practice
              </button>
            )}
          </form>
        ) : (
          <div className="button-row">
            <button
              className="secondary-button"
              disabled={busy || saving}
              onClick={() => reorder(true)}
            >
              Shuffle
            </button>
            <button
              className="text-button"
              disabled={busy || saving}
              onClick={() => reorder(false)}
            >
              Reset deck
            </button>
          </div>
        )}
        <span className="counter">
          {searching
            ? "Search result"
            : mode === "card"
              ? `${index + 1} / 52`
              : `Practice ${index + 1}`}
        </span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          {!current && (
            <button className="text-button" onClick={initial} disabled={busy}>
              Try again
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <section
        className="exercise panel"
        aria-label="Practice card"
        aria-busy={busy}
      >
        {busy ? (
          <div className="exercise-loading" role="status">
            Loading your practice…
          </div>
        ) : (
          <>
            {mode === "card" && !revealed ? (
              <div className="recall-face">
                <img
                  className="playing-card"
                  src={`/cards/${cards[index].id}.png`}
                  alt={cards[index].name}
                  width="160"
                  height="232"
                />
                <p>Picture the word you associate with this card.</p>
              </div>
            ) : current ? (
              <div className="prompt">
                <span className="eyebrow">
                  {mode === "word" ? "Your word" : "Your number"}
                </span>
                <h2>{wordEntry?.word ?? numberEntry?.number}</h2>
                {wordEntry?.ipa && (
                  <p>
                    {wordEntry.language} {wordEntry.ipa}
                  </p>
                )}
              </div>
            ) : (
              <p className="empty-state">
                {mode === "card"
                  ? "No word associations are saved for this card yet."
                  : "Nothing to show yet. Try searching or choose another practice."}
              </p>
            )}
            {hideAnswer && (current || mode === "card") && (
              <button
                className="reveal-button"
                aria-expanded={revealed}
                onClick={() => setRevealed(!revealed)}
              >
                {revealed ? "Hide answer" : "Reveal answer"}{" "}
                <span aria-hidden="true">↻</span>
              </button>
            )}
            {showAnswer && numberEntry && (
              <div className="answer">
                <h3>Your word association</h3>
                <p className="favorite-label">
                  {favorite ??
                    numberEntry.favorite ??
                    "Choose a word that brings an image to mind."}
                </p>
                <div className="word-choices">
                  {numberEntry.words.map((word) => (
                    <button
                      key={word}
                      disabled={saving || favoriteLoading || !!favoriteError}
                      aria-pressed={(favorite ?? numberEntry.favorite) === word}
                      onClick={() => chooseFavorite(word)}
                    >
                      <span aria-hidden="true">
                        {(favorite ?? numberEntry.favorite) === word
                          ? "♥"
                          : "♡"}
                      </span>{" "}
                      {word}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  Choose a favorite to use in your next practice.
                </p>
                {favoriteError && (
                  <p role="alert" className="error">
                    Your favorite couldn’t be loaded or saved. {favoriteError}{" "}
                    Reload to try again.
                  </p>
                )}
              </div>
            )}
            {showAnswer && wordEntry && (
              <div className="answer">
                <div className="word-number">
                  <span>Major System number</span>
                  <strong>{wordEntry.number || "Not available"}</strong>
                </div>
                {Object.entries(wordEntry.definitions).map(
                  ([part, definitions]) => (
                    <div className="definition" key={part}>
                      <h3>{part}</h3>
                      <ol>
                        {definitions.map((value, i) => (
                          <li key={i}>{value}</li>
                        ))}
                      </ol>
                    </div>
                  ),
                )}
              </div>
            )}
          </>
        )}
      </section>
      {!searching && (
        <div className="pager">
          <button
            className="secondary-button"
            onClick={previous}
            disabled={index === 0 || busy || saving}
          >
            ← Previous
          </button>
          <button
            className="button"
            onClick={next}
            disabled={
              busy ||
              saving ||
              (mode === "card"
                ? index === 51
                : mode === "number"
                  ? index >= numbers.length - 1 && !more.current
                  : false)
            }
          >
            Next practice →
          </button>
        </div>
      )}
    </>
  );
}
