import { NextRequest, NextResponse } from "next/server";
import { coc, encTag } from "../../coc/_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Tipos mínimos do endpoint /currentwar
type CWMember = {
  tag: string;
  name: string;
  mapPosition?: number; // vem da API
  townhallLevel?: number;
  attacks?: Array<{
    attackerTag: string;
    defenderTag: string;
    stars: number;
    destructionPercentage: number;
    order: number;
  }>;
};

type CurrentWar = {
  state: "notInWar" | "preparation" | "inWar" | "warEnded";
  teamSize?: number;
  endTime?: string; // formato 20250101T123456.000Z
  clan?: { name: string; tag: string; members?: CWMember[] };
  opponent?: { name: string; tag: string; members?: CWMember[] };
};

function parseCoCTime(raw?: string) {
  if (!raw) return null;
  // aceita “...000Z” e “...Z”
  const iso = raw.endsWith(".000Z") ? raw.replace(".000Z", "Z") : raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const tag =
    req.nextUrl.searchParams.get("tag") ||
    process.env.NEXT_PUBLIC_CLAN_TAG ||
    "";

  if (!tag.startsWith("#")) {
    return NextResponse.json(
      { error: "Use ?tag=#CLAN_TAG (inclua #)" },
      { status: 400 }
    );
  }

  try {
    const cw = await coc<CurrentWar>(`/clans/${encTag(tag)}/currentwar`);

    const you = [...(cw.clan?.members || [])].sort(
      (a, b) => (a.mapPosition ?? 999) - (b.mapPosition ?? 999)
    );
    const them = [...(cw.opponent?.members || [])].sort(
      (a, b) => (a.mapPosition ?? 999) - (b.mapPosition ?? 999)
    );

    const size = cw.teamSize || Math.max(you.length, them.length);
    const pairs = Array.from({ length: size }, (_, i) => ({
      pos: i + 1,
      you: you[i] || null,
      opp: them[i] || null,
    }));

    return NextResponse.json({
      state: cw.state,
      teamSize: size,
      endsAt: parseCoCTime(cw.endTime),
      clanName: cw.clan?.name || "—",
      opponentName: cw.opponent?.name || "—",
      pairs, // [{pos, you, opp}]
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro consultando a API" },
      { status: 502 }
    );
  }
}
