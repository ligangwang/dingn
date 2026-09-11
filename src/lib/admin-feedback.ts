import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { firebase } from "./firebase";
export type FeedbackCursor = QueryDocumentSnapshot<DocumentData>;
export async function readFeedbackPage(cursor?: FeedbackCursor) {
  const result = await getDocs(
    query(
      collection(firebase().db, "feedback"),
      orderBy("createdAt", "desc"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(25),
    ),
  );
  return {
    items: result.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        message: String(data.message ?? ""),
        uid: String(data.uid ?? ""),
        status: String(data.status ?? "new"),
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    }),
    cursor: result.docs.at(-1),
    more: result.size === 25,
  };
}
