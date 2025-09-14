import { NextResponse } from "next/server";

// ⚠️ Troque pelo SEU token real (o mesmo usado no curl que funcionou)
const COC_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImY4ZDI1NDBkLWMyMWEtNDM5MC1hOWJhLTM0MDRlOGE1MDExOSIsImlhdCI6MTc1NzU5Njc3NSwic3ViIjoiZGV2ZWxvcGVyL2E3ZjJhZDMwLTBmNmYtYmU3My00M2QwLWVkM2E2NWQ0ZWViMSIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjE5MS43LjQyLjg1Il0sInR5cGUiOiJjbGllbnQifV19.9WTwEk3gL2_O4DDhvHqxfBhFpYr1bSJqyVHZLE0_DdEGDYASxp1zqqzKXAPVVEIBXQALjVY_fpU1s2GxR3W-DA";

function clampTag(raw?: string | null) {
  if (!raw) return "";
  const t = decodeURIComponent(raw).trim().toUpperCase();
  return t.startsWith("#") ? t : `#${t}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag = clampTag(searchParams.get("tag") || "%232QLLU89LP"); // fallback no seu clã
  if (!tag) {
    return NextResponse.json({ error: "missing tag" }, { status: 400 });
  }

  try {
    // busca últimas 10 seasons
    const apiUrl = `https://api.clashofclans.com/v1/clans/${encodeURIComponent(
      tag
    )}/capitalraidseasons?limit=10`;

    const r = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${COC_KEY}` },
      cache: "no-store",
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `COC API ${r.status}`, details: text },
        { status: r.status }
      );
    }

    const data = await r.json();
    const items = data?.items || [];

    const ongoing = items.find((x: any) => x.state === "ongoing") || null;

    // lifetime = soma de todas as raids retornadas
    const capitalTotalLootLifetime = items.reduce(
      (sum: number, raid: any) => sum + (raid.capitalTotalLoot || 0),
      0
    );

    return NextResponse.json({
      raid: ongoing,
      capitalTotalLootLifetime,
      lifetime: {
        seasons: items.length,
        totalAttacks: items.reduce(
          (sum: number, raid: any) => sum + (raid.totalAttacks || 0),
          0
        ),
        enemyDistrictsDestroyed: items.reduce(
          (sum: number, raid: any) => sum + (raid.enemyDistrictsDestroyed || 0),
          0
        ),
      },
    });
  } catch (err: any) {
    console.error("Erro em /api/portal/raids:", err);
    return NextResponse.json(
      { error: "internal error", details: err?.message || err },
      { status: 500 }
    );
  }
}
