// Emails from the game platform. They are queued in the Firestore `mail`
// collection in the format of Firebase's "Trigger Email from Firestore"
// extension, which sends them once it is installed with an SMTP account.
// Without it, emails simply stay queued. Sending never blocks or fails the
// action that caused it.
import { addDoc } from "./platform-store.mjs";

/** The addresses that hear about new uploads and reports (REVIEW_EMAIL). */
export const reviewers = () =>
  (process.env.REVIEW_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export async function queueMail(to, subject, text) {
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!list.length) return;
  try {
    await addDoc("mail", {
      to: list,
      message: { subject, text },
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("mail", error);
  }
}
