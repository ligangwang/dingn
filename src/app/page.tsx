import { Home } from "@/components/home";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/", "en");
export default function Page() {
  return <Home />;
}
