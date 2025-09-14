// app/api/wars/mirror/route.ts
import { NextRequest, NextResponse } from "next/server";
import { coc, encTag } from "../../coc/_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CWMember = {
  name: string;
  tag: string;
  townhallLevel?: number;
  mapPosition: number;
  attacks?: Array<{
    defenderTag: string;
    stars: number;
    destructionPercentage: number;
  }>;
};

type CurrentWar = {
  state: "preparation" | "inWar" | "warEnded" | "notInWar";
  endTime?: string;
  clan: { name: string; tag: string; members: CWMember[] };
  opponent: { name: string; tag: string; members: CWMember[] };
};

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag") || "";
  if (!tag.startsWith("#")) {
    return NextResponse.json({ error: "Use ?tag=#CLAN_TAG" }, { status: 400 });
  }

  try {
    const cw = await coc<CurrentWar>(`/clans/${encTag(tag)}/currentwar`);

    if (!cw || cw.state === "notInWar") {
      return NextResponse.json({
        state: cw?.state ?? "notInWar",
        endTime: null,
        opponent: null,
        pairs: [],
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const left = [...cw.clan.members].sort((a,b)=>a.mapPosition-b.mapPosition);
    const right = [...cw.opponent.members].sort((a,b)=>a.mapPosition-b.mapPosition);

    const pairs = left.map(l => {
      const r = right.find(x => x.mapPosition === l.mapPosition) || null;
      const atk = (l.attacks && l.attacks[0]) || null;
      return {
        position: l.mapPosition,
        me: {
          name: l.name, tag: l.tag, th: l.townhallLevel ?? 0,
          attack: atk ? {
            stars: atk.stars,
            destruction: atk.destructionPercentage,
            defenderTag: atk.defenderTag,
          } : null,
        },
        opp: r ? { name: r.name, tag: r.tag, th: r.townhallLevel ?? 0 } : null,
      };
    });

    const end = cw.endTime ? new Date(cw.endTime.replace(".000Z","Z")).toISOString() : null;

    return NextResponse.json({
      state: cw.state,
      endTime: end,
      opponent: cw.opponent?.name ?? null,
      pairs
    }, { headers: { "Cache-Control":"no-store" } });

  } catch (e: any) {
    if (e?.status === 403 || e?.status === 404) {
      // War privada ou sem guerra no momento
      return NextResponse.json({
        state: "private_or_no_war",
        endTime: null,
        opponent: null,
        pairs: []
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 502 });
  }
}
