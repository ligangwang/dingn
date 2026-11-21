import { pageMetadata } from "@/lib/seo";
import { localeOfPrefix } from "@/lib/packs.server";
export { default } from "@/app/(en)/privacy/page";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  return pageMetadata("/privacy/", localeOfPrefix((await params).lang));
}
