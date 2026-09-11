import { AdminFeedback } from "@/components/admin-feedback";
export const metadata = {
  title: "Feedback inbox",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminFeedback />;
}
