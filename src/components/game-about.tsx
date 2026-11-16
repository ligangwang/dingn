"use client";
// Below a game: where it sits on dingn (breadcrumbs), what it is, and more
// games from its category. The server fills the same in while the game
// loads (gamePageHtml in scripts/game-seo.mjs), for crawlers.
import Link from "next/link";
import { useLocale } from "./locale";
import { CATEGORY_INFO, GameCard, playPath, useCatalog } from "./catalog";
import { gamesIn, tagOf, type Category } from "@/lib/catalog";

export function GameAbout({
  game,
}: {
  game: {
    id: string;
    title: { en: string; zh: string };
    description: { en: string; zh: string };
    category?: Category;
  };
}) {
  const { t, locale, href } = useLocale();
  const catalog = useCatalog();
  const l = locale === "zh-CN" ? "zh" : "en";
  const category = game.category ?? "casual";
  const info = CATEGORY_INFO[category];
  const title = game.title[l] || game.title.en;
  const description = game.description[l] || game.description.en;
  const others = catalog
    ? gamesIn(catalog, category, l)
        .filter((g) => g.id !== game.id)
        .slice(0, 4)
    : [];
  return (
    <section className="game-about" aria-labelledby="game-about-heading">
      <nav className="breadcrumbs" aria-label={t("Breadcrumb")}>
        <ol>
          <li>
            <Link href={href("/")}>dingn</Link>
          </li>
          <li>
            <Link href={href(info.path)}>{t(`${info.label} games`)}</Link>
          </li>
          <li aria-current="page">
            <Link href={href(playPath(game.id))}>{title}</Link>
          </li>
        </ol>
      </nav>
      <h2 id="game-about-heading">{t(`About ${title}`)}</h2>
      {description && <p className="lede">{description}</p>}
      {others.length > 0 && (
        <>
          <h2>{t(`More ${info.label.toLowerCase()} games`)}</h2>
          <div className="game-grid">
            {others.map((g) => (
              <GameCard key={g.id} game={g} tag={tagOf(g, catalog!)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
