import { CategoryPage } from "@/components/catalog";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/memory/", "en");
export default function MemoryPage() {
  return <CategoryPage category="memory" />;
}
