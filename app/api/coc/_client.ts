export const runtime = "nodejs";
const BASE = "https://api.clashofclans.com/v1";

function getToken() {
  const t = process.env.COC_TOKEN;
  if (!t) throw new Error("COC_TOKEN ausente nas envs");
  return t;
}

export async function coc<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${getToken()}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err: any = new Error(`CoC API ${res.status} ${res.statusText} - ${body}`);
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export function encTag(tag: string) { return `%23${tag.replace("#", "")}`; }
