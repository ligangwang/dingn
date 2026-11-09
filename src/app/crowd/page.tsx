import { GameHost } from "@/components/game-host";
import { pageMetadata } from "@/lib/seo";
import "../play/play.css";
// Crowd Rush is published on the game platform (games/crowd); this page plays
// its live version, so a Crowd Rush release never redeploys the website.
export const metadata = pageMetadata("/crowd/", "en");
export default function CrowdPage() {
  return <GameHost gameId="crowd" />;
}
