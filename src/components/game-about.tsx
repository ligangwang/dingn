"use client";
// Below a game: where it sits on dingn (breadcrumbs), what it is, and more
// games from its category. The server fills the same in while the game
// loads (gamePageHtml in scripts/game-seo.mjs), for crawlers.
import { pick } from "@/lib/i18n";
import Link from "next/link";
import { useLocale } from "./locale";
import { CATEGORY_INFO, GameCard, playPath, useCatalog } from "./catalog";
import { gamesIn, tagOf, type Category } from "@/lib/catalog";

export function GameAbout({
  game,
}: {
  game: {
    id: string;
    title: { en: string } & Record<string, string | undefined>;
    description: { en: string } & Record<string, string | undefined>;
    category?: Category;
  };
}) {
  const { t, locale, href } = useLocale();
  const catalog = useCatalog();
  const l = locale;
  const category = game.category ?? "casual";
  const info = CATEGORY_INFO[category];
  const title = pick(game.title, l);
  const description = pick(game.description, l);
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
