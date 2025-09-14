// app/api/wars/attacks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { coc, encTag } from "../../coc/_client";

// Força execução dinâmica sem cache
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type WarAttack = {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
  duration?: number;
};

type WarMember = {
  tag: string;
  name: string;
  townhallLevel: number;
  mapPosition: number;
  attacks?: WarAttack[];
  opponentAttacks?: number;
  bestOpponentAttack?: WarAttack;
};

type CurrentWar = {
  state: "notInWar" | "preparation" | "inWar" | "warEnded";
  teamSize?: number;
  attacksPerMember?: number;
  battleModifier?: string;
  preparationStartTime?: string;
  startTime?: string;
  endTime?: string;
  clan?: {
    tag: string;
    name: string;
    badgeUrls?: any;
    clanLevel?: number;
    attacks?: number;
    stars?: number;
    destructionPercentage?: number;
    members?: WarMember[];
  };
  opponent?: {
    tag: string;
    name: string;
    badgeUrls?: any;
    clanLevel?: number;
    attacks?: number;
    stars?: number;
    destructionPercentage?: number;
    members?: WarMember[];
  };
};

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag") || "";

  if (!tag || !tag.startsWith("#")) {
    return NextResponse.json(
      { error: "Invalid tag. Use ?tag=#CLAN_TAG" },
      { status: 400 }
    );
  }

  try {
    // Faz a chamada para a API do CoC
    const war = await coc<CurrentWar>(`/clans/${encTag(tag)}/currentwar`);

    console.log(`War state for ${tag}: ${war.state}`);

    // Se não está em guerra, retorna estado simplificado
    if (war.state === "notInWar") {
      return NextResponse.json(
        {
          state: "notInWar",
          teamSize: 0,
          clan: null,
          opponent: null,
          startTime: null,
          endTime: null,
          preparationStartTime: null,
          pairs: [],
          totals: {
            our: { stars: 0, destruction: 0, attacks: 0 },
            opp: { stars: 0, destruction: 0, attacks: 0 },
          },
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "Surrogate-Control": "no-store",
          },
        }
      );
    }

    const ourMembers = war.clan?.members || [];
    const oppMembers = war.opponent?.members || [];

    // Mapas por posição
    const oursMap = new Map<number, WarMember>();
    ourMembers.forEach((m) => oursMap.set(m.mapPosition, m));

    const oppMap = new Map<number, WarMember>();
    oppMembers.forEach((m) => oppMap.set(m.mapPosition, m));

    const teamSize = war.teamSize || Math.max(oursMap.size, oppMap.size) || 0;
    const attacksPerMember = war.attacksPerMember || 2;

    // Coletar todos os ataques do nosso clã (contra oponentes)
    const allOurAttacks = ourMembers.flatMap(m => m.attacks || []);

    // Coletar todos os ataques do oponente (contra nós)
    const allOppAttacks = oppMembers.flatMap(m => m.attacks || []);

    // Helper: escolher melhor ataque (mais estrelas, depois mais destruição)
    function bestAttack(attacks: WarAttack[], defenderTag: string) {
      const filtered = attacks.filter((a) => a.defenderTag === defenderTag);
      if (filtered.length === 0) return null;

      return filtered.reduce((best, curr) => {
        if (curr.stars > best.stars) return curr;
        if (
          curr.stars === best.stars &&
          curr.destructionPercentage > best.destructionPercentage
        )
          return curr;
        return best;
      }, { stars: -1, destructionPercentage: -1 } as WarAttack);
    }

    // Cria pares
    const pairs = Array.from({ length: teamSize }, (_, i) => {
      const pos = i + 1;
      const ourMember = oursMap.get(pos);
      const oppMember = oppMap.get(pos);

      let ourAttack: WarAttack | null = null;
      let oppAttack: WarAttack | null = null;

      if (ourMember && oppMember) {
        // Melhor ataque nosso contra este inimigo (de qualquer atacante nosso)
        ourAttack = bestAttack(allOurAttacks, oppMember.tag);

        // Melhor ataque deles contra este nosso jogador (de qualquer atacante deles)
        oppAttack = bestAttack(allOppAttacks, ourMember.tag);
      }

      return {
        pos,
        ours: ourMember
          ? {
              name: ourMember.name,
              tag: ourMember.tag,
              th: ourMember.townhallLevel,
            }
          : null,
        opp: oppMember
          ? {
              name: oppMember.name,
              tag: oppMember.tag,
              th: oppMember.townhallLevel,
            }
          : null,
        ourAttack: ourAttack && ourAttack.stars >= 0
          ? {
              stars: ourAttack.stars,
              destruction: ourAttack.destructionPercentage,
              order: ourAttack.order,
              duration: ourAttack.duration,
            }
          : null,
        oppAttack: oppAttack && oppAttack.stars >= 0
          ? {
              stars: oppAttack.stars,
              destruction: oppAttack.destructionPercentage,
              order: oppAttack.order,
              duration: oppAttack.duration,
            }
          : null,
      };
    });

    // Totais
    const ourTotals = {
      stars: war.clan?.stars || 0,
      destruction: war.clan?.destructionPercentage ? parseFloat(war.clan.destructionPercentage.toFixed(2)) : 0,
      attacks: war.clan?.attacks || 0,
    };

    const oppTotals = {
      stars: war.opponent?.stars || 0,
      destruction: war.opponent?.destructionPercentage ? parseFloat(war.opponent.destructionPercentage.toFixed(2)) : 0,
      attacks: war.opponent?.attacks || 0,
    };

    // Se API não trouxe totais, calcula
    if (!war.clan?.stars) {
      ourTotals.stars = ourMembers.reduce((total, member) => {
        if (!member.attacks) return total;
        return total + member.attacks.reduce((s, a) => s + a.stars, 0);
      }, 0);
    }

    if (!war.opponent?.stars) {
      oppTotals.stars = oppMembers.reduce((total, member) => {
        if (!member.attacks) return total;
        return total + member.attacks.reduce((s, a) => s + a.stars, 0);
      }, 0);
    }

    if (!war.clan?.attacks) {
      ourTotals.attacks = ourMembers.reduce(
        (total, member) => total + (member.attacks?.length || 0),
        0
      );
    }

    if (!war.opponent?.attacks) {
      oppTotals.attacks = oppMembers.reduce(
        (total, member) => total + (member.attacks?.length || 0),
        0
      );
    }

    const response = {
      state: war.state,
      teamSize,
      attacksPerMember,
      battleModifier: war.battleModifier,
      clan: {
        name: war.clan?.name || "",
        tag: war.clan?.tag || "",
        level: war.clan?.clanLevel,
      },
      opponent: {
        name: war.opponent?.name || "",
        tag: war.opponent?.tag || "",
        level: war.opponent?.clanLevel,
      },
      preparationStartTime: war.preparationStartTime || null,
      startTime: war.startTime || null,
      endTime: war.endTime || null,
      pairs,
      totals: {
        our: ourTotals,
        opp: oppTotals,
      },
      raw: {
        ourMembersCount: ourMembers.length,
        oppMembersCount: oppMembers.length,
        maxAttacksPossible: teamSize * attacksPerMember * 2,
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
        "X-War-State": war.state,
        "X-Last-Updated": new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Error fetching war data:", err);

    return NextResponse.json(
      {
        error: err?.message || "Failed to fetch current war",
        details: err?.toString(),
        timestamp: new Date().toISOString(),
      },
      {
        status: err?.status || 502,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}