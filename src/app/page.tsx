import Link from "next/link";
import { soundGuide } from "@/lib/models";
export default function Home() {
  return (
    <div className="home container">
      <section className="intro">
        <p className="eyebrow">A little practice. A more vivid memory.</p>
        <h1>
          Make room for
          <br />
          remarkable recall.
        </h1>
        <p className="lede">
          Turn numbers, words, and playing cards into things you remember.
          <br className="desktop-break" /> Choose a practice to get started.
        </p>
      </section>
      <section className="practice-grid" aria-label="Choose a practice">
        {[
          {
            name: "Numbers",
            text: "Give every number a picture.",
            href: "/number/",
            art: ["2", "7"],
            kind: "numbers",
          },
          {
            name: "Words",
            text: "Build connections that stick.",
            href: "/word/",
            art: ["a", "b"],
            kind: "words",
          },
          {
            name: "Playing cards",
            text: "Make every card memorable.",
            href: "/card/",
            art: ["♠", "♥"],
            kind: "cards",
          },
        ].map((item) => (
          <Link className="practice-link" key={item.href} href={item.href}>
            <div className={`practice-art ${item.kind}`} aria-hidden="true">
              <div className="tile left">{item.art[0]}</div>
              <div className="tile right">{item.art[1]}</div>
              <span className="spark">✦</span>
            </div>
            <div className="practice-copy">
              <h2>
                {item.name}
                <span aria-hidden="true">↗</span>
              </h2>
              <p>{item.text}</p>
              <span className="start">Start practicing</span>
            </div>
          </Link>
        ))}
      </section>
      <section className="guide panel">
        <h2>A simple trick for a lasting memory</h2>
        <p>
          The Major System turns numbers into consonant sounds. Add vowels to
          make words, then picture them. An image is easier to recall than a
          string of digits.
        </p>
        <h3 className="eyebrow">Your number–sound guide</h3>
        <dl className="sound-grid">
          {soundGuide.map((sound, i) => (
            <div key={i}>
              <dt>{i}</dt>
              <dd>{sound}</dd>
            </div>
          ))}
        </dl>
        <p className="example">
          Try it: <strong>2 → n + 3 → m → name</strong>
        </p>
      </section>
      <p className="support">
        <a href="mailto:support@dingn.com?subject=Issues%20or%20Suggestions">
          Have an idea? We’d love to hear it.
        </a>
      </p>
    </div>
  );
}
