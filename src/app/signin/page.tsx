import { SignIn } from "@/components/auth";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/signin/", "en");
export default function Page() {
  return <SignIn />;
}
