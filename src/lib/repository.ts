import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { firebase } from "./firebase";
import {
  favoriteRecord,
  numberFromData,
  profileFromData,
  profileRecord,
  wordFromData,
  type Profile,
} from "./models";
export type Cursor = QueryDocumentSnapshot<DocumentData>;
export async function readProfile(uid: string) {
  const snap = await getDoc(doc(firebase().db, "accounts", uid));
  return profileFromData(snap.data());
}
export async function saveProfile(uid: string, profile: Profile) {
  await setDoc(doc(firebase().db, "accounts", uid), profileRecord(profile), {
    merge: true,
  });
}
export async function readNumbers(digits: number, cursor?: Cursor) {
  const constraints = [
    where("digits", "==", digits),
    orderBy("number"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(20),
  ];
  const snap = await getDocs(
    query(collection(firebase().db, "numbers"), ...constraints),
  );
  return {
    items: snap.docs.map((d) => numberFromData(d.id, d.data())),
    cursor: snap.docs.at(-1),
    more: snap.size === 20,
  };
}
export async function readNumber(number: string) {
  const snap = await getDoc(doc(firebase().db, "numbers", number));
  return snap.exists() ? numberFromData(snap.id, snap.data()) : null;
}
export async function readWord(word: string) {
  const snap = await getDoc(doc(firebase().db, "words", word));
  return snap.exists() ? wordFromData(snap.id, snap.data()) : null;
}
export async function randomWord() {
  // Match the signed 64-bit random field used by the existing Flutter app.
  const pivot = (Math.random() * 2 - 1) * 2 ** 63;
  const words = collection(firebase().db, "words");
  let snap = await getDocs(
    query(words, where("random", ">=", pivot), orderBy("random"), limit(1)),
  );
  if (snap.empty)
    snap = await getDocs(query(words, orderBy("random"), limit(1)));
  return snap.empty ? null : wordFromData(snap.docs[0].id, snap.docs[0].data());
}
export async function readFavorite(uid: string, number: string) {
  const snap = await getDoc(
    doc(firebase().db, "number_favorites", `${uid}-${number}`),
  );
  return typeof snap.data()?.favoriteWord === "string"
    ? (snap.data()!.favoriteWord as string)
    : null;
}
export async function saveFavorite(uid: string, number: string, word: string) {
  const record = favoriteRecord(uid, number, word);
  await setDoc(doc(firebase().db, "number_favorites", record.id), record.data, {
    merge: true,
  });
}
