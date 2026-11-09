import { MindGame } from "@/components/mind-game";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/decisions/", "en");
export default function Page() {
  return <MindGame mode="decisions" />;
}
