import { GameHost } from "@/components/game-host";
import { pageMetadata } from "@/lib/seo";
import "./play.css";
// One page plays every published game: the server serves it for /play/<id>/.
export const metadata = pageMetadata("/play/", "en");
export default function PlayPage() {
  return <GameHost />;
}
