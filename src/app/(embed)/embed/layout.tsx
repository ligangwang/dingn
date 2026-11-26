import { EmbedChrome } from "@/components/embed-chrome";
/** The embedded player in English, at /embed/<id>/. */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmbedChrome>{children}</EmbedChrome>;
}
