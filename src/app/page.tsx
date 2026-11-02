import Link from "next/link";
import { WarmUp } from "@/components/warm-up";
import { DecisionIcon, LogicIcon, MemoryIcon } from "@/components/icons";
import { Leaderboard } from "@/components/xp";
export default function Home() {
  return (
    <div className="mind-home container">
      <section className="mind-hero">
        <div>
          <p className="eyebrow">MEMORY · LOGIC · DECISIONS</p>
          <h1>
            Play with purpose.
            <br />
            <span>Think one move ahead.</span>
          </h1>
          <p className="lede">
            Remember the details. Connect the clues. Make your move.
            <br />
            Welcome to your mind arcade.
          </p>
          <a className="button" href="#games">
            Find your next game ↗
          </a>
          <p className="hero-caption">
            Short rounds. Fresh perspectives. Your pace.
          </p>
        </div>
        <div className="mind-art" aria-hidden="true">
          <span className="orbit-label">THINK / PLAY / REPEAT</span>
          <img src="/dingn-mark.svg" alt="" />
          <span className="art-chip chip-one">32 → ☾</span>
          <span className="art-chip chip-two">WHAT’S NEXT?</span>
          <span className="art-chip chip-three">YOUR MOVE ↗</span>
        </div>
      </section>
      <section id="games">
        <div className="mind-heading">
          <div>
            <p className="eyebrow">THREE WAYS TO PLAY</p>
            <h2>Your mind. Your playground.</h2>
          </div>
          <span>No sign-in needed</span>
        </div>
        <div className="arena-grid">
          <a href="#warm-up" className="arena memory-arena">
            <MemoryIcon className="arena-symbol" size={52} />
            <p className="eyebrow">01 / MEMORY</p>
            <h2>Make it stick.</h2>
            <p>
              Catch a sequence. Hold it in your head. Recall it before it slips
              away.
            </p>
            <strong>Try the 3-digit warm-up ↓</strong>
          </a>
          <Link href="/logic/" className="arena logic-arena">
            <LogicIcon className="arena-symbol" size={52} />
            <p className="eyebrow">02 / LOGIC</p>
            <h2>Crack the pattern.</h2>
            <p>
              Connect the clues and put your reasoning to work in four quick
              puzzles.
            </p>
            <strong>Play logic lab →</strong>
          </Link>
          <Link href="/decisions/" className="arena decision-arena">
            <DecisionIcon className="arena-symbol" size={52} />
            <p className="eyebrow">03 / DECISIONS</p>
            <h2>Choose your move.</h2>
            <p>
              Weigh the odds, work with a budget, and discover why the goal
              matters.
            </p>
            <strong>Play decision room →</strong>
          </Link>
        </div>
      </section>
      <div id="warm-up">
        <WarmUp />
      </div>
      <Leaderboard />
      <section className="memory-library">
        <p className="eyebrow">GO DEEPER WITH MEMORY</p>
        <h2>Build connections that stick.</h2>
        <p>
          Explore the Major System: turn numbers into sounds, words, and
          pictures you can remember.
        </p>
        <div className="library-links">
          <Link href="/number/">Number lab ↗</Link>
          <Link href="/word/">Word universe ↗</Link>
          <Link href="/card/">Deck quest ↗</Link>
        </div>
      </section>
      <p className="support">
        <Link href="/feedback/">Have a game idea? Help shape dingn ↗</Link>
      </p>
    </div>
  );
}
