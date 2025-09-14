// app/wars/attacks/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from "react";
import { 
  ArrowLeft, Swords, Shield, Star, Crown, Trophy, 
  Target, CheckCircle, XCircle, Clock, RefreshCw,
  TrendingUp, AlertCircle, Users, Zap
} from "lucide-react";

// Tipos
interface WarAttack {
  stars: number;
  destruction: number;
  order: number;
  duration?: number;
}

interface WarMember {
  name: string;
  tag: string;
  th: number;
}

interface Pair {
  pos: number;
  ours: WarMember | null;
  opp: WarMember | null;
  ourAttack: WarAttack | null;
  oppAttack: WarAttack | null;
}

interface WarData {
  state: "notInWar" | "preparation" | "inWar" | "warEnded";
  teamSize: number;
  attacksPerMember?: number;
  clan: { name: string; tag: string } | null;
  opponent: { name: string; tag: string } | null;
  startTime: string | null;
  endTime: string | null;
  pairs: Pair[];
  totals?: {
    our: { stars: number; destruction: number; attacks: number };
    opp: { stars: number; destruction: number; attacks: number };
  };
}

// Configurações
const CLAN_TAG = process.env.NEXT_PUBLIC_CLAN_TAG || "#2QLLU89LP";
const POLLING_INTERVAL = 30000; // 30 segundos

// Helper para TH icons
const thIcon = (th?: number) => `/cv/CV${Math.max(1, Math.min(17, Number(th || 1)))}.png`;

// Componente de Status do Ataque
function AttackStatus({ attack, isOur }: { attack: WarAttack | null; isOur: boolean }) {
  if (!attack) {
    return (
      <div className="flex items-center gap-1 text-xs text-white/40">
        <XCircle className="h-3 w-3" />
        <span>Não atacou</span>
      </div>
    );
  }

  const getStarColor = (stars: number) => {
    if (stars === 3) return "text-emerald-400";
    if (stars === 2) return "text-amber-400";
    if (stars === 1) return "text-orange-400";
    return "text-rose-400";
  };

  const getDestructionColor = (destruction: number) => {
    if (destruction === 100) return "text-emerald-400";
    if (destruction >= 70) return "text-amber-400";
    if (destruction >= 50) return "text-orange-400";
    return "text-rose-400";
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-0.5 ${getStarColor(attack.stars)}`}>
          {[...Array(3)].map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < attack.stars ? "fill-current" : "opacity-20"
              }`}
            />
          ))}
        </div>
        <span className={`text-sm font-bold ${getDestructionColor(attack.destruction)}`}>
          {attack.destruction.toFixed(0)}%
        </span>
      </div>
      {attack.order && (
        <div className="text-xs text-white/40">
          #{attack.order}° ataque
          {attack.duration && ` • ${Math.floor(attack.duration / 60)}:${(attack.duration % 60).toString().padStart(2, '0')}`}
        </div>
      )}
    </div>
  );
}

// Componente de Card do Par
function PairCard({ pair, index }: { pair: Pair; index: number }) {
  const hasOurAttack = pair.ourAttack !== null;
  const hasOppAttack = pair.oppAttack !== null;
  const isPerfect = pair.ourAttack?.stars === 3 && pair.ourAttack?.destruction === 100;
  const oppIsPerfect = pair.oppAttack?.stars === 3 && pair.oppAttack?.destruction === 100;

  return (
    <div className={`rounded-2xl border p-4 transition-all hover:scale-[1.01] ${
      isPerfect 
        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent" 
        : hasOurAttack
        ? "border-white/20 bg-white/5"
        : "border-white/10 bg-white/[0.02]"
    }`}>
      {/* Cabeçalho com posição */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-black text-white/20">#{pair.pos}</div>
          {isPerfect && (
            <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              Perfeito!
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasOurAttack && <CheckCircle className="h-4 w-4 text-emerald-400" />}
          {hasOppAttack && <Shield className="h-4 w-4 text-rose-400" />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Nosso Jogador */}
        <div className={`rounded-xl border p-3 ${
          hasOurAttack 
            ? "border-emerald-500/20 bg-emerald-500/5" 
            : "border-white/10 bg-black/20"
        }`}>
          <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
            <Users className="h-3 w-3" />
            <span>Nosso</span>
          </div>
          
          {pair.ours ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <img src={thIcon(pair.ours.th)} alt="" className="h-5 w-5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{pair.ours.name}</div>
                  <div className="text-xs text-white/40 truncate">{pair.ours.tag}</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10">
                <AttackStatus attack={pair.ourAttack} isOur={true} />
              </div>
            </>
          ) : (
            <div className="text-sm text-white/30">Vazio</div>
          )}
        </div>

        {/* Oponente */}
        <div className={`rounded-xl border p-3 ${
          oppIsPerfect
            ? "border-rose-500/20 bg-rose-500/5"
            : hasOppAttack 
            ? "border-orange-500/20 bg-orange-500/5" 
            : "border-white/10 bg-black/20"
        }`}>
          <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
            <Target className="h-3 w-3" />
            <span>Oponente</span>
          </div>
          
          {pair.opp ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <img src={thIcon(pair.opp.th)} alt="" className="h-5 w-5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{pair.opp.name}</div>
                  <div className="text-xs text-white/40 truncate">{pair.opp.tag}</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10">
                <AttackStatus attack={pair.oppAttack} isOur={false} />
              </div>
            </>
          ) : (
            <div className="text-sm text-white/30">Vazio</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente de Estatísticas
function WarStats({ data }: { data: WarData }) {
  const totals = data.totals || {
    our: { stars: 0, destruction: 0, attacks: 0 },
    opp: { stars: 0, destruction: 0, attacks: 0 }
  };

  const maxAttacks = (data.teamSize || 0) * (data.attacksPerMember || 2);
  const ourProgress = maxAttacks > 0 ? (totals.our.attacks / maxAttacks) * 100 : 0;
  const oppProgress = maxAttacks > 0 ? (totals.opp.attacks / maxAttacks) * 100 : 0;

  const isWinning = totals.our.stars > totals.opp.stars || 
    (totals.our.stars === totals.opp.stars && totals.our.destruction > totals.opp.destruction);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Card de Placar */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white/60">Placar Geral</div>
          {isWinning && <Trophy className="h-4 w-4 text-emerald-400" />}
        </div>
        <div className="flex items-center justify-around">
          <div className="text-center">
            <div className="text-3xl font-black text-emerald-400">{totals.our.stars}</div>
            <div className="text-xs text-white/60">Nossas ★</div>
          </div>
          <div className="text-white/20 text-2xl">VS</div>
          <div className="text-center">
            <div className="text-3xl font-black text-rose-400">{totals.opp.stars}</div>
            <div className="text-xs text-white/60">Deles ★</div>
          </div>
        </div>
      </div>

      {/* Card de Destruição */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white/60">Destruição Média</div>
          <Zap className="h-4 w-4 text-amber-400" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Nós</span>
            <span className="text-lg font-bold text-amber-200">
              {totals.our.destruction.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Eles</span>
            <span className="text-lg font-bold text-orange-200">
              {totals.opp.destruction.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Card de Progresso */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white/60">Ataques Realizados</div>
          <Swords className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Nós</span>
              <span className="text-emerald-400">{totals.our.attacks}/{maxAttacks}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                style={{ width: `${ourProgress}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Eles</span>
              <span className="text-rose-400">{totals.opp.attacks}/{maxAttacks}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all"
                style={{ width: `${oppProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook para buscar dados
function useWarMirror(clanTag: string) {
  const [data, setData] = useState<WarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const url = `/api/wars/attacks?tag=${encodeURIComponent(clanTag)}&t=${Date.now()}&r=${Math.random()}`;
      const response = await fetch(url, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const json = await response.json();
      setData(json);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [clanTag]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, error, loading, lastUpdate, refetch: fetchData };
}

// Componente Principal
export default function WarMirrorPage() {
  const { data, error, loading, lastUpdate, refetch } = useWarMirror(CLAN_TAG);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "attacked" | "pending">("all");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredPairs = data?.pairs.filter(pair => {
    if (filter === "attacked") return pair.ourAttack !== null;
    if (filter === "pending") return pair.ourAttack === null && pair.ours !== null;
    return true;
  }) || [];

  const getStateLabel = () => {
    if (!data) return "";
    switch (data.state) {
      case "inWar": return "Guerra em Andamento";
      case "preparation": return "Dia de Preparação";
      case "warEnded": return "Guerra Finalizada";
      default: return "Sem Guerra Ativa";
    }
  };

  const getStateColor = () => {
    if (!data) return "border-white/10";
    switch (data.state) {
      case "inWar": return "border-emerald-500/30 bg-emerald-500/5";
      case "preparation": return "border-amber-500/30 bg-amber-500/5";
      case "warEnded": return "border-sky-500/30 bg-sky-500/5";
      default: return "border-white/10";
    }
  };

  return (
    <main className="min-h-screen text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(139,92,246,0.1),transparent)]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a 
              href="/" 
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </a>
            <h1 className="text-2xl font-black inline-flex items-center gap-2">
              <Swords className="h-6 w-6 text-violet-400" />
              Espelho de Guerra
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <div className="text-xs text-white/40">
                Atualizado: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && !data && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
            <div className="mt-4 text-white/60">Carregando dados da guerra...</div>
          </div>
        )}

        {/* Error State */}
        {error && !data && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <div className="flex items-center gap-2 text-rose-400 mb-2">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Erro ao carregar dados</span>
            </div>
            <div className="text-sm text-white/60">{error}</div>
          </div>
        )}

        {/* Content */}
        {data && (
          <>
            {/* War Status Bar */}
            <div className={`rounded-2xl border p-4 mb-6 ${getStateColor()}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/60">Status</div>
                  <div className="text-lg font-bold">{getStateLabel()}</div>
                </div>
                {data.opponent && (
                  <div>
                    <div className="text-sm font-medium text-white/60">Oponente</div>
                    <div className="text-lg font-bold">{data.opponent.name}</div>
                  </div>
                )}
                {data.endTime && (
                  <div>
                    <div className="text-sm font-medium text-white/60">Termina em</div>
                    <div className="text-lg font-mono">
                      <Clock className="h-4 w-4 inline mr-1" />
                      {new Date(data.endTime).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Statistics */}
            {data.state !== "notInWar" && <WarStats data={data} />}

            {/* Filters */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === "all" 
                    ? "bg-violet-600 text-white" 
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                Todos ({data.pairs.length})
              </button>
              <button
                onClick={() => setFilter("attacked")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === "attacked" 
                    ? "bg-violet-600 text-white" 
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                Atacados ({data.pairs.filter(p => p.ourAttack).length})
              </button>
              <button
                onClick={() => setFilter("pending")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === "pending" 
                    ? "bg-violet-600 text-white" 
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                Pendentes ({data.pairs.filter(p => !p.ourAttack && p.ours).length})
              </button>
            </div>

            {/* Mirror Grid */}
            {filteredPairs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <div className="text-white/60">
                  {data.state === "notInWar" 
                    ? "Nenhuma guerra ativa no momento" 
                    : "Nenhum resultado para o filtro selecionado"}
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredPairs.map((pair, index) => (
                  <PairCard key={pair.pos} pair={pair} index={index} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}