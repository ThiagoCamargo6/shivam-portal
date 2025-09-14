// app/coc/_client.ts
const API_BASE = "https://api.clashofclans.com/v1";
const TOKEN = process.env.COC_API_TOKEN || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImY4ZDI1NDBkLWMyMWEtNDM5MC1hOWJhLTM0MDRlOGE1MDExOSIsImlhdCI6MTc1NzU5Njc3NSwic3ViIjoiZGV2ZWxvcGVyL2E3ZjJhZDMwLTBmNmYtYmU3My00M2QwLWVkM2E2NWQ0ZWViMSIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjE5MS43LjQyLjg1Il0sInR5cGUiOiJjbGllbnQifV19.9WTwEk3gL2_O4DDhvHqxfBhFpYr1bSJqyVHZLE0_DdEGDYASxp1zqqzKXAPVVEIBXQALjVY_fpU1s2GxR3W-DA"; // 👈 pode hardcodear pra testar

export async function coc(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`COC API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export function encTag(tag: string) {
  return encodeURIComponent(tag.startsWith("#") ? tag : `#${tag}`);
}
