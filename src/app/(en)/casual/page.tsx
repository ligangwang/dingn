import { CategoryPage } from "@/components/catalog";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/casual/", "en");
export default function CasualPage() {
  return <CategoryPage category="casual" />;
}
