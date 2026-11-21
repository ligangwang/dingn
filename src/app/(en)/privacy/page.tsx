import { Privacy } from "@/components/legal";
import { pageMetadata } from "@/lib/seo";
import "../developers/developers.css";
export const metadata = pageMetadata("/privacy/", "en");
export default function Page() {
  return <Privacy />;
}
