// An empty element the dingn server fills in before sending the page
// (fillSlot in scripts/game-seo.mjs), with games the browser would otherwise
// only see after fetching /api/games: so crawlers that don't run scripts see
// them, and visitors see them before the page's scripts load.
//
// React keeps whatever the server put inside (dangerouslySetInnerHTML is not
// compared while hydrating), and renders it empty after an in-app
// navigation, when the page's own components show the games instead.
import type { ElementType } from "react";

export function ServerFill({
  name,
  as: Tag = "div",
  className,
}: {
  name: string;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag
      className={className}
      data-fill={name}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: "" }}
    />
  );
}
