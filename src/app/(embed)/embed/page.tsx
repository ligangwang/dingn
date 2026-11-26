import { GameHost } from "@/components/game-host";
import { pageMetadata } from "@/lib/seo";
import "@/app/(en)/play/play.css";
// One page is every game's embedded player: the server serves it for
// /embed/<id>/, and other websites show it in a frame.
export const metadata = pageMetadata("/embed/", "en");
export default function EmbedPage() {
  return <GameHost embed />;
}
