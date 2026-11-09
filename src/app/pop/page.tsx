import { PopRedirect } from "./redirect";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/pop/", "en");
/** Bubble Calm used to live here; old links now go to Crowd Rush. */
export default function PopPage() {
  return <PopRedirect />;
}
