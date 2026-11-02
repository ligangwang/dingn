import { addDoc, collection, serverTimestamp } from "./database";
import { database } from "./database";

export async function submitFeedback(uid: string, message: string) {
  const trimmed = message.trim();
  if (!uid || !trimmed || trimmed.length > 5000)
    throw new Error("Invalid feedback");
  await addDoc(collection(database, "feedback"), {
    uid,
    message: trimmed,
    createdAt: serverTimestamp(),
    status: "new",
  });
}
