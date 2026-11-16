import { CategoryPage } from "@/components/catalog";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/adventure/", "en");
export default function AdventurePage() {
  return <CategoryPage category="adventure" />;
}
