import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebase } from "./firebase";

export async function submitFeedback(uid: string, message: string) {
  const trimmed = message.trim();
  if (!uid || !trimmed || trimmed.length > 5000)
    throw new Error("Invalid feedback");
  await addDoc(collection(firebase().db, "feedback"), {
    uid,
    message: trimmed,
    createdAt: serverTimestamp(),
    status: "new",
  });
}
