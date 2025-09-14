import { NextRequest, NextResponse } from "next/server";
import { coc, encTag } from "../../coc/_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Tipos mínimos da CoC API (atenção: members = número, memberList = array)
type ClanResp = {
  name: string; tag: string; description?: string;
  type: "inviteOnly" | "closed" | "open";
  location?: { name: string };
  warLeague?: { name: string };
  clanLevel: number; clanPoints: number;
  members: number; // contagem
  memberList: Array<{
    name: string;
    tag: string;
    role: "leader" | "coLeader" | "admin" | "member";
    expLevel: number;
    townHallLevel?: number;
    trophies: number;
    donations: number;
    donationsReceived?: number;
    league?: { name: string };
  }>;
};

type WarlogItem = {
  result: "win" | "lose" | "tie";
  teamSize: number;
  endTime: string; // ex: 20250101T123456.000Z
  clan: { stars: number; destructionPercentage: number };
  opponent: { name: string; stars: number; destructionPercentage: number };
};

type CurrentWar = {
  state: string; // preparation|inWar|warEnded|notInWar
  endTime?: string; // ex: 20250101T123456.000Z
  opponent?: { name?: string };
};

// --- Normalizador de datas CoC -> ISO “expandido” ---
// De "YYYYMMDDThhmmss.mmmZ" para "YYYY-MM-DDThh:mm:ss.mmmZ"
function parseCoCTimeToISO(s?: string): string | null {
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/.exec(s);
  if (m) {
    const [, Y, Mo, D, H, Mi, S, Ms] = m;
    return `${Y}-${Mo}-${D}T${H}:${Mi}:${S}.${Ms}Z`;
  }
  // Fallback: tenta parse nativo (caso a Supercell mude o formato)
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toMember(m: ClanResp["memberList"][number]) {
  return {
    name: m.name,
    tag: m.tag,
    role: m.role === "admin" ? ("elder" as const) : (m.role as any),
    level: m.expLevel,
    townHall: m.townHallLevel ?? 0,
    trophies: m.trophies,
    donations: m.donations,
  };
}

function mapWar(w: WarlogItem) {
  const endedISO = parseCoCTimeToISO(w.endTime) ?? new Date().toISOString();
  return {
    opponent: w.opponent.name,
    result: w.result === "win" ? "W" : w.result === "lose" ? "L" : "T",
    starsFor: w.clan.stars,
    starsAgainst: w.opponent.stars,
    destructionFor: w.clan.destructionPercentage,
    destructionAgainst: w.opponent.destructionPercentage,
    endedAt: endedISO,
  };
}

function hintFromStatus(status?: number) {
  if (status === 401) return "Token inválido/expirado — gere um novo no Developer Portal.";
  if (status === 403) return "IP não autorizado no token OU warlog privado. Adicione seu IP público à allowlist e verifique a privacidade do warlog.";
  if (status === 429) return "Rate limit — aguarde um pouco ou reduza a frequência.";
  return undefined;
}

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag") || "";
  if (!tag.startsWith("#")) {
    return NextResponse.json(
      { error: "Use ?tag=#CLAN_TAG (inclua #)" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    // 1) Clan (obrigatório)
    const clan = await coc<ClanResp>(`/clans/${encTag(tag)}`);

    // 2) Warlog (tolerante a 403 = privado)
    let warItems: WarlogItem[] = [];
    let warlogPrivate = false;
    try {
      const w = await coc<{ items: WarlogItem[] }>(`/clans/${encTag(tag)}/warlog?limit=10`);
      warItems = w.items || [];
    } catch (e: any) {
      if (e?.status === 403) {
        warlogPrivate = true;
      } else if (e?.status !== 404) {
        throw e;
      }
    }

    // 3) Guerra atual (tolerante a 403/404)
    let current: CurrentWar | null = null;
    try {
      current = await coc<CurrentWar>(`/clans/${encTag(tag)}/currentwar`);
    } catch (e: any) {
      if (e?.status === 404 || e?.status === 403) current = null; else throw e;
    }

    const mappedClan = {
      name: clan.name,
      tag: clan.tag,
      description: clan.description ?? "",
      type: clan.type,
      location: clan.location?.name ?? "—",
      warLeague: clan.warLeague?.name ?? "—",
      clanLevel: clan.clanLevel,
      clanPoints: clan.clanPoints,
      members: clan.memberList?.map(toMember) ?? [],
    };

    const wars = warItems.map(mapWar);

    const currentWarEndsAt =
      current?.endTime ? (parseCoCTimeToISO(current.endTime) ?? null) : null;

    const currentWarOpponent = current?.opponent?.name ?? null;

    return NextResponse.json(
      { clan: mappedClan, wars, currentWarEndsAt, currentWarOpponent, warlogPrivate },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    const status = err?.status || 502;
    console.error("[portal/summary] fail:", status, err?.message);
    return NextResponse.json(
      {
        error: err?.message || "Erro consultando a API",
        status,
        hint: hintFromStatus(status),
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
