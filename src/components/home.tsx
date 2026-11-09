"use client";
import { useLocale } from "@/components/locale";
import Link from "next/link";
import { WarmUp } from "@/components/warm-up";
import {
  CrowdIcon,
  DecisionIcon,
  LogicIcon,
  MemoryIcon,
} from "@/components/icons";
import { Leaderboard } from "@/components/xp";
export function Home() {
  const { t, locale, href } = useLocale();

  return (
    <div className="mind-home container">
      <section className="mind-hero">
        <div>
          <p className="eyebrow">{t("THE DINGN GAME PLATFORM")}</p>
          <h1>
            {t("Your next adventure.")}
            <br />
            <span>{t("Starts here.")}</span>
          </h1>
          <p className="lede">
            {t("Quick challenges today. New worlds to explore tomorrow.")}
            <br />
            {t("One platform. Your own way to play.")}
          </p>
          <a className="button" href="#games">
            {t("Find your next game ↗")}
          </a>
          <p className="hero-caption">
            {t("Short rounds. Fresh perspectives. Your pace.")}
          </p>
        </div>
        <div className="mind-art" aria-hidden="true">
          <span className="orbit-label">{t("THINK / PLAY / REPEAT")}</span>
          <img src="/dingn-mark.svg" alt="" />
          <span className="art-chip chip-one">32 → ☾</span>
          <span className="art-chip chip-two">{t("WHAT’S NEXT?")}</span>
          <span className="art-chip chip-three">{t("YOUR MOVE ↗")}</span>
        </div>
      </section>
      <section id="games">
        <div className="mind-heading">
          <div>
            <p className="eyebrow">{t("FOUR WAYS TO PLAY")}</p>
            <h2>{t("Your mind. Your playground.")}</h2>
          </div>
          <span>{t("No sign-in needed")}</span>
        </div>
        <div className="arena-grid">
          <a href="#warm-up" className="arena memory-arena">
            <MemoryIcon className="arena-symbol" size={52} />
            <p className="eyebrow">{t("01 / MEMORY")}</p>
            <h2>{t("Make it stick.")}</h2>
            <p>
              {t(
                "Catch a sequence. Hold it in your head. Recall it before it slips away.",
              )}
            </p>
            <strong>{t("Play Memory Ladder ↓")}</strong>
          </a>
          <Link href={href("/logic/")} className="arena logic-arena">
            <LogicIcon className="arena-symbol" size={52} />
            <p className="eyebrow">{t("02 / LOGIC")}</p>
            <h2>{t("Crack the pattern.")}</h2>
            <p>
              {t(
                "Connect the clues and put your reasoning to work in four quick puzzles.",
              )}
            </p>
            <strong>{t("Play logic lab →")}</strong>
          </Link>
          <Link href={href("/decisions/")} className="arena decision-arena">
            <DecisionIcon className="arena-symbol" size={52} />
            <p className="eyebrow">{t("03 / DECISIONS")}</p>
            <h2>{t("Choose your move.")}</h2>
            <p>
              {t(
                "Weigh the odds, work with a budget, and discover why the goal matters.",
              )}
            </p>
            <strong>{t("Play decision room →")}</strong>
          </Link>
          <Link href={href("/crowd/")} className="arena crowd-arena">
            <CrowdIcon className="arena-symbol" size={52} />
            <p className="eyebrow">{t("04 / ACTION")}</p>
            <h2>{t("Grow your squad.")}</h2>
            <p>
              {t(
                "Pick the right gates, blast through crates and rival squads, then beat the boss.",
              )}
            </p>
            <strong>{t("Play Crowd Rush →")}</strong>
          </Link>
        </div>
      </section>
      <div id="warm-up">
        <WarmUp />
      </div>
      <Leaderboard />
      <section className="memory-library">
        <p className="eyebrow">{t("GO DEEPER WITH MEMORY")}</p>
        <h2>{t("Build connections that stick.")}</h2>
        <p>
          {t(
            "Explore the Major System: turn numbers into sounds, words, and pictures you can remember.",
          )}
        </p>
        <div className="library-links">
          <Link href={href("/number/")}>{t("Number lab ↗")}</Link>
          <Link href={href("/word/")}>{t("Word universe ↗")}</Link>
          <Link href={href("/card/")}>{t("Deck quest ↗")}</Link>
        </div>
      </section>
      <p className="support">
        <Link href={href("/feedback/")}>
          {t("Have a game idea? Help shape dingn ↗")}
        </Link>
      </p>
    </div>
  );
}
