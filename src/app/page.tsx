import { Home } from "@/components/home";
import { JsonLd } from "@/components/json-ld";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
export const metadata = pageMetadata("/", "en");
export default function Page() {
  return (
    <>
      <JsonLd data={siteJsonLd("en")} />
      <Home />
    </>
  );
}
