import { DeveloperAgreement } from "@/components/developer-agreement";
import { pageMetadata } from "@/lib/seo";
import "../developers.css";
export const metadata = pageMetadata("/developers/agreement/", "en");
export default function Page() {
  return <DeveloperAgreement />;
}
