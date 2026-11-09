import { DevPlayground } from "@/components/dev-playground";
import { pageMetadata } from "@/lib/seo";
import "../developers.css";
export const metadata = pageMetadata("/developers/playground/", "en");
export default function Page() {
  return <DevPlayground />;
}
