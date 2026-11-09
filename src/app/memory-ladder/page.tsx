import { WarmUp } from "@/components/warm-up";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/memory-ladder/", "en");
export default function MemoryLadderPage() {
  return (
    <div className="container mind-page">
      <WarmUp />
    </div>
  );
}
