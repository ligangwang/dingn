// A small same-origin REST adapter. No Firebase browser SDK is initialized for data access.
import { api } from "./api";
export type DocumentData = Record<string, any>;
type Value = Record<string, any>;
type WireDocument = { name: string; fields?: Record<string, Value> };
export type QueryDocumentSnapshot<T = DocumentData> = {
  id: string;
  name: string;
  data: () => T;
  exists: () => boolean;
  fields: Record<string, Value>;
};
type Reference = { collection: string; id?: string };
type Constraint = { kind: string; field?: string; op?: string; value?: any };
export const database = {};
export const collection = (_db: unknown, name: string): Reference => ({
  collection: name,
});
export const doc = (_db: unknown, name: string, id: string): Reference => ({
  collection: name,
  id,
});
export const where = (
  field: string,
  op: string,
  value: unknown,
): Constraint => ({ kind: "where", field, op, value });
export const orderBy = (field: string, direction = "asc"): Constraint => ({
  kind: "order",
  field,
  value: direction,
});
export const limit = (value: number): Constraint => ({ kind: "limit", value });
export const startAfter = (value: QueryDocumentSnapshot): Constraint => ({
  kind: "cursor",
  value,
});
export const query = (ref: Reference, ...constraints: Constraint[]) => ({
  ...ref,
  constraints,
});
export const serverTimestamp = () => ({ __timestamp: true });
function encode(value: any): Value {
  if (value === null) return { nullValue: null };
  if (value?.__timestamp) return { serverTimestamp: true };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number")
    return Number.isSafeInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: fields(value) } };
}
function fields(value: DocumentData) {
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, encode(v)]),
  );
}
function decode(value: Value): any {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value)
    return { toDate: () => new Date(value.timestampValue) };
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return unpack(value.mapValue.fields || {});
  return null;
}
function unpack(value: Record<string, Value>): DocumentData {
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, decode(v)]),
  );
}
function snapshot(
  document: WireDocument | null,
  id = "",
): QueryDocumentSnapshot {
  return {
    id: document ? document.name.split("/").at(-1)! : id,
    name: document?.name || "",
    fields: document?.fields || {},
    exists: () => document !== null,
    data: () => unpack(document?.fields || {}),
  };
}
export async function getDoc(ref: Reference) {
  return snapshot(
    await api<WireDocument | null>("/api/data", { ...ref, operation: "get" }),
    ref.id,
  );
}
export async function setDoc(
  ref: Reference,
  value: DocumentData,
  _options: { merge: boolean },
) {
  await api("/api/data", { ...ref, operation: "set", fields: fields(value) });
}
export async function addDoc(ref: Reference, value: DocumentData) {
  await api("/api/data", { ...ref, operation: "add", fields: fields(value) });
}
export async function getDocs(ref: Reference & { constraints: Constraint[] }) {
  const filters = ref.constraints
    .filter((c) => c.kind === "where")
    .map((c) => ({
      fieldFilter: {
        field: { fieldPath: c.field },
        op: c.op === "==" ? "EQUAL" : "GREATER_THAN_OR_EQUAL",
        value: encode(c.value),
      },
    }));
  const orders = ref.constraints
    .filter((c) => c.kind === "order")
    .map((c) => ({
      field: { fieldPath: c.field! },
      direction: c.value === "desc" ? "DESCENDING" : "ASCENDING",
    }));
  // Include document ID as a stable tiebreaker, matching Firestore's implicit ordering.
  orders.push({
    field: { fieldPath: "__name__" },
    direction: orders.at(-1)?.direction || "ASCENDING",
  });
  const cursor = ref.constraints.find((c) => c.kind === "cursor")?.value as
    QueryDocumentSnapshot | undefined;
  const structuredQuery = {
    from: [{ collectionId: ref.collection }],
    orderBy: orders,
    limit: ref.constraints.find((c) => c.kind === "limit")?.value || 20,
    ...(filters.length
      ? {
          where:
            filters.length === 1
              ? filters[0]
              : { compositeFilter: { op: "AND", filters } },
        }
      : {}),
    ...(cursor
      ? {
          startAt: {
            before: false,
            values: orders.map((o) =>
              o.field.fieldPath === "__name__"
                ? { referenceValue: cursor.name }
                : cursor.fields[o.field.fieldPath],
            ),
          },
        }
      : {}),
  };
  const result = await api<{ document?: WireDocument }[]>("/api/data", {
    operation: "query",
    collection: ref.collection,
    query: structuredQuery,
  });
  const docs = result
    .filter((r) => r.document)
    .map((r) => snapshot(r.document!));
  return { docs, size: docs.length, empty: docs.length === 0 };
}
