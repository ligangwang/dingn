import { Developers } from "@/components/developers";
import { pageMetadata } from "@/lib/seo";
import "./developers.css";
export const metadata = pageMetadata("/developers/", "en");
export default function Page() {
  return <Developers />;
}
