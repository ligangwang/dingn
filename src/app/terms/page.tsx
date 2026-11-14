import { Terms } from "@/components/legal";
import { pageMetadata } from "@/lib/seo";
import "../developers/developers.css";
export const metadata = pageMetadata("/terms/", "en");
export default function Page() {
  return <Terms />;
}
