import {
  collection,
  getDocs,
  getDoc,
  doc,
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
  // Read each profile once per page, including authors of older submissions.
  const names = new Map<string, string>();
  const uids = [
    ...new Set(result.docs.map((item) => String(item.data().uid ?? ""))),
  ];
  await Promise.all(
    uids
      .filter((uid) => uid && !uid.includes("/"))
      .map(async (uid) => {
        try {
          const profile = await getDoc(doc(firebase().db, "accounts", uid));
          const name = profile.data()?.user_name;
          if (typeof name === "string" && name.trim())
            names.set(uid, name.trim());
        } catch {
          // A missing or unavailable profile must not hide its feedback.
        }
      }),
  );
  return {
    items: result.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        message: String(data.message ?? ""),
        uid: String(data.uid ?? ""),
        authorName: names.get(String(data.uid ?? "")) || "",
        status: String(data.status ?? "new"),
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    }),
    cursor: result.docs.at(-1),
    more: result.size === 25,
  };
}
