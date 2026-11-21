import { pageMetadata } from "@/lib/seo";
import { localeOfPrefix } from "@/lib/packs.server";
export { default } from "@/app/(en)/developers/agreement/page";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  return pageMetadata("/developers/agreement/", localeOfPrefix((await params).lang));
}
