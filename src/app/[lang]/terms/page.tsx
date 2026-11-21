import { pageMetadata } from "@/lib/seo";
import { localeOfPrefix } from "@/lib/packs.server";
export { default } from "@/app/(en)/terms/page";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  return pageMetadata("/terms/", localeOfPrefix((await params).lang));
}
