import { Kingdom } from "@/components/kingdom";
import { pageMetadata } from "@/lib/seo";
import "./kingdom.css";
export const metadata = pageMetadata("/kingdom/", "en");
export default function Page() {
  return <Kingdom />;
}
