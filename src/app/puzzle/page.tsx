import { CategoryPage } from "@/components/catalog";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/puzzle/", "en");
export default function PuzzlePage() {
  return <CategoryPage category="puzzle" />;
}
