import { Kingdom } from "@/components/kingdom";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/kingdom/", "en");
export default function Page() {
  return <Kingdom />;
}
