import { Home } from "@/components/home";
import { JsonLd } from "@/components/json-ld";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { localeOfPrefix } from "@/lib/packs.server";
type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props) {
  return pageMetadata("/", localeOfPrefix((await params).lang));
}
export default async function Page({ params }: Props) {
  return (
    <>
      <JsonLd data={siteJsonLd(localeOfPrefix((await params).lang))} />
      <Home />
    </>
  );
}
