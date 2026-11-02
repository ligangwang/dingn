export async function api<T>(route: string, body: unknown = {}): Promise<T> {
  const response = await fetch(route, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Dingn-Request": "1" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || "unavailable"), {
      code: data.error || "unavailable",
    });
  return data as T;
}
