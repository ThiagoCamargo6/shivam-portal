'use client';

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ChevronLeft, Shield, Sword, Star, Sparkles,
  Search, SortAsc, TriangleAlert, RefreshCw,
  Filter, Download, TrendingUp, Target,
  Trophy, Clock, AlertCircle, Check, X, Crown
} from "lucide-react";

const CLAN_TAG = process.env.NEXT_PUBLIC_CLAN_TAG || "#YOURTAG";
const POLLING_INTERVAL = 30000; // 30 segundos
const SEARCH_DEBOUNCE = 300; // 300ms;

/* ----------------------------- Tipagens ---------------------------- */
type Pair = {
  pos: number;
  ours: { name: string; tag: string; th: number; donations?: number; trophies?: number } | null;
  opp: { name: string; tag: string; th: number } | null;
  ourAttack: { stars: number; destruction: number; order: number; duration?: number } | null;
  oppAttack: { stars: number; destruction: number; order: number; duration?: number } | null;
};

type Payload = {
  state: "notInWar" | "preparation" | "inWar" | "warEnded";
  teamSize: number;
  clan: { name?: string; tag?: string };
  opponent: { name?: string; tag?: string };
  startTime?: string | null;
  endTime?: string | null;
  totals?: {
    our: { stars: number; destruction?: number; attacks?: number };
    opp: { stars: number; destruction?: number; attacks?: number };
  };
  pairs: Pair[];
};

type FilterOptions = {
  search: string;
  sort: "pos" | "thdiff" | "stars" | "notAttacked";
  thRange: [number, number];
  showOnlyMismatches: boolean;
  showOnlyNotAttacked: boolean;
};

type WarStats = {
  averageStars: number;
  participationRate: number;
  thMismatchRate: number;
  perfectAttacks: number;
  totalDestruction: number;
};

/* ----------------------------- Hooks Customizados ---------------------------- */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

function useWarData(clanTag: string, enablePolling: boolean = false) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const url = `/api/wars/attacks?tag=${encodeURIComponent(clanTag)}`;
      const response = await fetch(url, { cache: "no-store" });
      
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const json: Payload = await response.json();
      setData(json);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clanTag]);

  useEffect(() => {
    fetchData();
    
    if (enablePolling) {
      intervalRef.current = setInterval(fetchData, POLLING_INTERVAL);
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, enablePolling]);

  return { data, error, loading, lastUpdate, refetch: fetchData };
}

/* ----------------------------- Helpers ---------------------------- */
function thTone(th?: number) {
  if (!th) return "bg-white/10 text-white/70";
  if (th >= 16) return "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-200 ring-1 ring-amber-500/40 shadow-amber-500/20 shadow-sm";
  if (th >= 15) return "bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/30";
  if (th >= 13) return "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30";
  if (th >= 11) return "bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/30";
  return "bg-zinc-700/30 text-zinc-200 ring-1 ring-zinc-500/30";
}

function thIcon(th?: number) {
  const n = Math.max(1, Math.min(17, Number(th) || 1));
  return `/cv/CV${n}.png`;
}

function calculateStats(pairs: Pair[]): WarStats {
  const attacked = pairs.filter(p => p.ourAttack !== null);
  const perfect = attacked.filter(p => p.ourAttack?.stars === 3);
  const totalPlayers = pairs.filter(p => p.ours !== null).length;
  const mismatches = pairs.filter(p => {
    if (!p.ours || !p.opp) return false;
    return Math.abs(p.ours.th - p.opp.th) >= 2;
  });

  return {
    averageStars: attacked.length > 0 
      ? attacked.reduce((sum, p) => sum + (p.ourAttack?.stars || 0), 0) / attacked.length 
      : 0,
    participationRate: totalPlayers > 0 ? (attacked.length / totalPlayers) * 100 : 0,
    thMismatchRate: pairs.length > 0 ? (mismatches.length / pairs.length) * 100 : 0,
    perfectAttacks: perfect.length,
    totalDestruction: attacked.reduce((sum, p) => sum + (p.ourAttack?.destruction || 0), 0) / attacked.length || 0
  };
}

function getBestPlayer(pairs: Pair[]): { name: string; stars: number; totalDuration: number } | null {
  let bestPlayer = null;
  let maxStarsPerSecond = -Infinity;

  pairs.forEach(pair => {
    if (pair.ours && pair.ourAttack) {
      const attacks = [pair.ourAttack];
      if (pair.ourAttack.order === 1 && pair.ours.attacks && pair.ours.attacks[1]) {
        attacks.push(pair.ours.attacks[1]);
      }

      const totalStars = attacks.reduce((sum, attack) => sum + (attack.stars || 0), 0);
      const totalDuration = attacks.reduce((sum, attack) => sum + (attack.duration || 0), 0);

      if (totalDuration > 0) {
        const starsPerSecond = totalStars / totalDuration;
        if (starsPerSecond > maxStarsPerSecond) {
          maxStarsPerSecond = starsPerSecond;
          bestPlayer = {
            name: pair.ours.name,
            stars: totalStars,
            totalDuration: totalDuration
          };
        }
      }
    }
  });

  return bestPlayer;
}

function getTopDonator(pairs: Pair[]): { name: string; donations: number } | null {
  const donator = pairs
    .filter(p => p.ours?.donations)
    .reduce((max, p) => (p.ours!.donations! > (max?.donations || 0) ? p.ours : max), null);
  return donator ? { name: donator.name, donations: donator.donations! } : null;
}

function getTopTrophies(pairs: Pair[]): { name: string; trophies: number } | null {
  const trophyHolder = pairs
    .filter(p => p.ours?.trophies)
    .reduce((max, p) => (p.ours!.trophies! > (max?.trophies || 0) ? p.ours : max), null);
  return trophyHolder ? { name: trophyHolder.name, trophies: trophyHolder.trophies! } : null;
}

function getAttackQuality(attack: Pair["ourAttack"] | null) {
  if (!attack) return null;
  if (attack.stars === 3) return { label: "Perfeito", color: "text-emerald-400", icon: Trophy };
  if (attack.stars === 2 && attack.destruction >= 70) return { label: "Bom", color: "text-sky-400", icon: Check };
  if (attack.stars === 2) return { label: "Regular", color: "text-amber-400", icon: Target };
  if (attack.stars === 1) return { label: "Fraco", color: "text-orange-400", icon: AlertCircle };
  return { label: "Falhou", color: "text-rose-400", icon: X };
}

function exportToCSV(pairs: Pair[], clanName?: string, oppName?: string) {
  const headers = ['Posição', 'Nosso Jogador', 'TH Nosso', 'TH Oponente', 'Oponente', 'Estrelas Nossas', 'Destruição Nossa', 'Estrelas Deles', 'Destruição Deles'];
  const rows = pairs.map(p => [
    p.pos,
    p.ours?.name || '-',
    p.ours?.th || '-',
    p.opp?.th || '-',
    p.opp?.name || '-',
    p.ourAttack?.stars || '0',
    p.ourAttack?.destruction || '0',
    p.oppAttack?.stars || '0',
    p.oppAttack?.destruction || '0'
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `war_${clanName}_vs_${oppName}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function RenderStars({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= stars ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
        />
      ))}
    </div>
  );
}

/* ----------------------------- Componentes ---------------------------- */
function StatusPill({ state }: { state: Payload["state"] }) {
  const map: Record<Payload["state"], {label:string; cls:string; pulse?: boolean}> = {
    preparation: { 
      label: "Preparação", 
      cls:"bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
      pulse: true
    },
    inWar: { 
      label: "Em Guerra", 
      cls:"bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30",
      pulse: true
    },
    warEnded: { 
      label: "Guerra Finalizada", 
      cls:"bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30" 
    },
    notInWar: { 
      label: "Fora de Guerra", 
      cls:"bg-zinc-500/15 text-zinc-200 ring-1 ring-zinc-500/30" 
    },
  };
  const cfg = map[state];
  
  return (
    <span className={`relative px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.pulse && (
        <span className="absolute inset-0 rounded-full animate-ping opacity-75 bg-current" />
      )}
      <span className="relative">{cfg.label}</span>
    </span>
  );
}

function AttackChip({ who, attack, pair }: {
  who: "nosso" | "deles";
  attack: Pair["ourAttack"] | Pair["oppAttack"] | null;
  pair: Pair;
}) {
  const quality = who === "nosso" ? getAttackQuality(attack) : null;
  
  if (!attack) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-xs text-white/40">
        {who === "nosso" ? <Sparkles className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
        {who === "nosso" ? "Não atacou" : "Sem defesa"}
      </span>
    );
  }
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs transition-all hover:scale-105 ${
      who === "nosso" 
        ? "bg-emerald-500/10 border-emerald-500/30" 
        : "bg-rose-500/10 border-rose-500/30"
    }`}>
      {who === "nosso" ? (
        quality ? <quality.icon className={`h-3.5 w-3.5 ${quality.color}`} /> : <Sparkles className="h-3.5 w-3.5" />
      ) : (
        <Shield className="h-3.5 w-3.5 text-rose-400" />
      )}
      <span className="font-medium tabular-nums">
        {attack.stars}★ · {attack.destruction}%
      </span>
      {quality && who === "nosso" && (
        <span className={`text-[10px] ${quality.color} font-semibold uppercase tracking-wider`}>
          {quality.label}
        </span>
      )}
    </span>
  );
}

function ThDelta({ delta }: { delta: number }) {
  const tone =
    delta > 0 ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30" :
    delta < 0 ? "bg-rose-500/15 text-rose-200 ring-rose-500/30" :
                "bg-white/8 text-white/50 ring-white/10";
  
  return (
    <span className={`inline-flex w-14 h-6 items-center justify-center rounded ring-1 ${tone} text-xs font-medium tabular-nums transition-all hover:scale-110`}>
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

function StatsCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-rose-400",
    neutral: "text-white/60"
  };
  
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-start justify-between mb-2">
        <Icon className="h-5 w-5 text-white/40" />
        {trend && (
          <TrendingUp className={`h-4 w-4 ${trendColors[trend]} ${trend === 'down' ? 'rotate-180' : ''}`} />
        )}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-white/60 mt-1">{title}</div>
      {subtitle && <div className="text-xs text-white/40 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="py-3 px-3">
        <div className="h-4 bg-white/10 rounded w-8" />
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-white/10 rounded" />
          <div className="h-4 bg-white/10 rounded w-20" />
          <div className="space-y-1">
            <div className="h-4 bg-white/10 rounded w-24" />
            <div className="h-3 bg-white/5 rounded w-16" />
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-center">
        <div className="h-4 w-4 bg-white/10 rounded mx-auto" />
      </td>
      <td className="py-3 px-3">
        <div className="h-6 bg-white/10 rounded w-14 mx-auto" />
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-white/10 rounded" />
          <div className="h-4 bg-white/10 rounded w-20" />
          <div className="space-y-1">
            <div className="h-4 bg-white/10 rounded w-24" />
            <div className="h-3 bg-white/5 rounded w-16" />
          </div>
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex gap-2">
          <div className="h-6 bg-white/10 rounded w-20" />
          <div className="h-6 bg-white/10 rounded w-20" />
        </div>
      </td>
    </tr>
  );
}

function FilterPanel({ filters, onChange, stats }: {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  stats: WarStats;
}) {
  const perfectAttackRate = stats.perfectAttacks > 0 && stats.averageStars > 0 
    ? (stats.perfectAttacks / Math.max(1, stats.averageStars)) * 100 
    : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Filter className="h-4 w-4" />
        Filtros Avançados
      </h3>
      
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-white/60 mb-1 block">TH Range</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="17"
              value={filters.thRange[0]}
              onChange={(e) => onChange({
                ...filters,
                thRange: [parseInt(e.target.value) || 1, filters.thRange[1]]
              })}
              className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-sm"
            />
            <span className="text-white/40">até</span>
            <input
              type="number"
              min="1"
              max="17"
              value={filters.thRange[1]}
              onChange={(e) => onChange({
                ...filters,
                thRange: [filters.thRange[0], parseInt(e.target.value) || 17]
              })}
              className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-sm"
            />
          </div>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showOnlyMismatches}
            onChange={(e) => onChange({ ...filters, showOnlyMismatches: e.target.checked })}
            className="rounded border-white/20 bg-white/10 text-emerald-500"
          />
          <span className="text-xs">Apenas Mismatches (Δ ≥ 2)</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showOnlyNotAttacked}
            onChange={(e) => onChange({ ...filters, showOnlyNotAttacked: e.target.checked })}
            className="rounded border-white/20 bg-white/10 text-emerald-500"
          />
          <span className="text-xs">Apenas não atacados</span>
        </label>
      </div>
      
      <div className="pt-3 border-t border-white/10 space-y-2">
        <div className="text-xs text-white/60">Taxa de Ataques Perfeitos</div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all"
            style={{ width: `${perfectAttackRate}%` }}
          />
        </div>
        <div className="text-xs text-white/40">{perfectAttackRate.toFixed(1)}% de ataques perfeitos</div>
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */
export default function AttacksMirrorPage() {
  const [filters, setFilters] = useState<FilterOptions>({
    search: "",
    sort: "pos",
    thRange: [1, 17],
    showOnlyMismatches: false,
    showOnlyNotAttacked: false
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  const debouncedSearch = useDebounce(filters.search, SEARCH_DEBOUNCE);
  const { data, error, loading, lastUpdate, refetch } = useWarData(CLAN_TAG, autoRefresh);
  
  const filteredPairs = useMemo(() => {
    let arr = [...(data?.pairs ?? [])];
    
    // Aplicar filtro de busca
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      arr = arr.filter(p =>
        p.ours?.name.toLowerCase().includes(q) ||
        p.ours?.tag.toLowerCase().includes(q) ||
        p.opp?.name.toLowerCase().includes(q) ||
        p.opp?.tag.toLowerCase().includes(q)
      );
    }
    
    // Filtro de TH Range
    arr = arr.filter(p => {
      if (!p.ours) return true;
      return p.ours.th >= filters.thRange[0] && p.ours.th <= filters.thRange[1];
    });
    
    // Filtro de mismatches
    if (filters.showOnlyMismatches) {
      arr = arr.filter(p => {
        if (!p.ours || !p.opp) return false;
        return Math.abs(p.ours.th - p.opp.th) >= 2;
      });
    }
    
    // Filtro de não atacados
    if (filters.showOnlyNotAttacked) {
      arr = arr.filter(p => !p.ourAttack);
    }
    
    // Ordenação
    switch (filters.sort) {
      case "thdiff":
        arr.sort((a, b) => {
          const aDiff = Math.abs((a.ours?.th ?? 0) - (a.opp?.th ?? 0));
          const bDiff = Math.abs((b.ours?.th ?? 0) - (b.opp?.th ?? 0));
          return bDiff - aDiff || a.pos - b.pos;
        });
        break;
      case "stars":
        arr.sort((a, b) => {
          const aStars = a.ourAttack?.stars ?? -1;
          const bStars = b.ourAttack?.stars ?? -1;
          return bStars - aStars || a.pos - b.pos;
        });
        break;
      case "notAttacked":
        arr.sort((a, b) => {
          const aAttacked = a.ourAttack ? 1 : 0;
          const bAttacked = b.ourAttack ? 1 : 0;
          return aAttacked - bAttacked || a.pos - b.pos;
        });
        break;
      default:
        arr.sort((a, b) => a.pos - b.pos);
    }
    
    return arr;
  }, [data?.pairs, debouncedSearch, filters]);
  
  const stats = useMemo(() => calculateStats(data?.pairs ?? []), [data?.pairs]);
  const bestPlayer = useMemo(() => getBestPlayer(data?.pairs ?? []), [data?.pairs]);
  const topDonator = useMemo(() => getTopDonator(data?.pairs ?? []), [data?.pairs]);
  const topTrophies = useMemo(() => getTopTrophies(data?.pairs ?? []), [data?.pairs]);

  // Scoreboard
  const ourStars = data?.totals?.our?.stars ?? filteredPairs.reduce((s, p) => s + (p.ourAttack?.stars ?? 0), 0);
  const oppStars = data?.totals?.opp?.stars ?? filteredPairs.reduce((s, p) => s + (p.oppAttack?.stars ?? 0), 0);
  const ourDestruction = data?.totals?.our?.destruction ?? Math.round(stats.totalDestruction);
  const oppDestruction = data?.totals?.opp?.destruction ?? 0;
  
  const isWarActive = data?.state === "inWar" || data?.state === "preparation";
  
  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Link>
        
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Sword className="h-5 w-5 text-emerald-400" />
          Centro de Guerra
        </h1>
        
        <div className="ml-auto flex items-center gap-2">
          {isWarActive && (
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                autoRefresh 
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </button>
          )}
          
          <button
            onClick={refetch}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          
          {data && (
            <button
              onClick={() => exportToCSV(data.pairs, data.clan?.name, data.opponent?.name)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          )}
        </div>
      </header>
      
      {/* War Info & Scoreboard */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <StatusPill state={data?.state ?? "notInWar"} />
            <div className="text-sm text-white/70">
              <span className="font-semibold">{data?.clan?.name ?? "—"}</span>
              <span className="text-white/40 mx-2">VS</span>
              <span className="font-semibold">{data?.opponent?.name ?? "—"}</span>
            </div>
            <div className="ml-auto text-sm">
              <span className="text-white/40">Tamanho:</span>{" "}
              <span className="font-semibold">{data?.teamSize ?? 0}v{data?.teamSize ?? 0}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-xs text-emerald-200/60 uppercase tracking-wider mb-2">Nossa Pontuação</div>
              <div className="text-4xl font-black tabular-nums text-emerald-200">{ourStars}</div>
              <div className="text-sm text-emerald-200/80 mt-1">{ourDestruction}% destruição</div>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="text-xs text-rose-200/60 uppercase tracking-wider mb-2">Pontuação Deles</div>
              <div className="text-4xl font-black tabular-nums text-rose-200">{oppStars}</div>
              <div className="text-sm text-rose-200/80 mt-1">{oppDestruction}% destruição</div>
            </div>
          </div>
          
          {lastUpdate && (
            <div className="mt-4 text-xs text-white/40 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última atualização: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
        
        <div className="space-y-3">
          <StatsCard
            title="Ataques Perfeitos"
            value={stats.perfectAttacks}
            subtitle="3 estrelas"
            icon={Trophy}
            trend={stats.perfectAttacks > (data?.teamSize ?? 0) * 0.3 ? "up" : "down"}
          />
          {bestPlayer && (
            <StatsCard
              title="Melhor Jogador"
              value={bestPlayer.name}
              subtitle={`${bestPlayer.stars}★ em ${Math.floor(bestPlayer.totalDuration / 60)}:${(bestPlayer.totalDuration % 60).toString().padStart(2, '0')} min`}
              icon={Crown}
              trend="up"
            />
          )}
          {topDonator && (
            <StatsCard
              title="Top Doador"
              value={topDonator.name}
              subtitle={`${topDonator.donations} doações`}
              icon={Shield}
              trend="up"
            />
          )}
          {topTrophies && (
            <StatsCard
              title="Top Troféus"
              value={topTrophies.name}
              subtitle={`${topTrophies.trophies} troféus`}
              icon={Trophy}
              trend="up"
            />
          )}
        </div>
      </div>
      
      {/* Filters & Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Buscar jogador ou tag…"
            className="w-full pl-9 pr-3 h-11 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:bg-white/10 focus:border-white/20 transition-colors"
          />
        </div>
        
        <div className="inline-flex items-center gap-2 h-11 px-3 rounded-xl bg-white/5 border border-white/10">
          <SortAsc className="h-4 w-4" />
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value as any })}
            className="bg-transparent outline-none cursor-pointer text-sm"
          >
            <option value="pos">Ordenar: Posição</option>
            <option value="thdiff">Ordenar: Diferença TH</option>
            <option value="stars">Ordenar: Estrelas</option>
            <option value="notAttacked">Ordenar: Não Atacados</option>
          </select>
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
            showFilters 
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" 
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {(filters.showOnlyMismatches || filters.showOnlyNotAttacked || filters.thRange[0] > 1 || filters.thRange[1] < 17) && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-xs">
              {[
                filters.showOnlyMismatches,
                filters.showOnlyNotAttacked,
                filters.thRange[0] > 1 || filters.thRange[1] < 17
              ].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
          <TriangleAlert className="h-5 w-5 text-rose-400 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-200">Erro ao carregar dados</div>
            <div className="text-sm text-rose-200/70 mt-1">{error}</div>
            <button
              onClick={refetch}
              className="mt-2 text-sm text-rose-200 underline hover:no-underline"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      
      {/* Main Content Grid */}
      <div className={`grid gap-4 ${showFilters ? 'lg:grid-cols-[300px_1fr]' : ''}`}>
        {/* Filter Panel */}
        {showFilters && (
          <div className="lg:sticky lg:top-4 lg:h-fit">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              stats={stats}
            />
          </div>
        )}
        
        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/60 border-b border-white/10 bg-white/[0.02]">
                  <th className="py-3 px-4 text-left font-medium">#</th>
                  <th className="py-3 px-4 text-left font-medium">Nosso Jogador</th>
                  <th className="py-3 px-4 text-center font-medium">VS</th>
                  <th className="py-3 px-4 text-center font-medium">Δ TH</th>
                  <th className="py-3 px-4 text-left font-medium">Oponente</th>
                  <th className="py-3 px-4 text-left font-medium min-w-[300px]">Status de Ataque</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : filteredPairs.length > 0 ? (
                  filteredPairs.map((pair, idx) => {
                    const delta = (pair.ours?.th ?? 0) - (pair.opp?.th ?? 0);
                    const mismatch = Math.abs(delta) >= 2;
                    const isNotAttacked = !pair.ourAttack;
                    
                    return (
                      <tr
                        key={pair.pos}
                        className={`
                          border-b border-white/5 transition-all hover:bg-white/[0.03]
                          ${idx % 2 ? "bg-white/[0.01]" : ""}
                          ${isNotAttacked ? "bg-amber-500/[0.02]" : ""}
                        `}
                      >
                        {/* Position */}
                        <td className="py-3 px-4">
                          <span className="font-semibold tabular-nums text-white/80">
                            {pair.pos}
                          </span>
                        </td>
                        
                        {/* Our Player */}
                        <td className="py-3 px-4">
                          {pair.ours ? (
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <div className="relative">
                                <Image
                                  src={thIcon(pair.ours.th)}
                                  alt={`TH ${pair.ours.th}`}
                                  width={32}
                                  height={32}
                                  className="rounded-lg shadow-sm"
                                />
                                {!pair.oppAttack && (
                                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {pair.oppAttack && <RenderStars stars={pair.oppAttack.stars} />}
                                <div className="font-semibold truncate">{pair.ours.name}</div>
                                <div className="text-xs text-white/50 truncate">{pair.ours.tag}</div>
                              </div>
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${thTone(pair.ours.th)}`}>
                                TH{pair.ours.th}
                              </span>
                            </div>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        
                        {/* VS Icon */}
                        <td className="py-3 px-4 text-center">
                          <div className="relative inline-block">
                            <Shield className={`h-5 w-5 ${
                              mismatch ? "text-amber-400" : "text-white/30"
                            }`} />
                            {mismatch && (
                              <div className="absolute -top-1 -right-1">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* TH Delta */}
                        <td className="py-3 px-4 text-center">
                          <ThDelta delta={delta} />
                        </td>
                        
                        {/* Opponent */}
                        <td className="py-3 px-4">
                          {pair.opp ? (
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <div className="relative">
                                <Image
                                  src={thIcon(pair.opp.th)}
                                  alt={`TH ${pair.opp.th}`}
                                  width={32}
                                  height={32}
                                  className="rounded-lg shadow-sm"
                                />
                                {!pair.ourAttack && (
                                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {pair.ourAttack && <RenderStars stars={pair.ourAttack.stars} />}
                                <div className="font-semibold truncate">{pair.opp.name}</div>
                                <div className="text-xs text-white/50 truncate">{pair.opp.tag}</div>
                              </div>
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${thTone(pair.opp.th)}`}>
                                TH{pair.opp.th}
                              </span>
                            </div>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        
                        {/* Attack Status */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <AttackChip who="nosso" attack={pair.ourAttack} pair={pair} />
                            <AttackChip who="deles" attack={pair.oppAttack} pair={pair} />
                            {isNotAttacked && isWarActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                                <AlertCircle className="h-3 w-3 text-amber-400" />
                                <span className="text-amber-200 font-medium">Pendente</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Search className="h-8 w-8 text-white/20" />
                        <div className="text-white/60">Nenhum resultado encontrado</div>
                        <div className="text-sm text-white/40">
                          Tente ajustar os filtros ou termo de busca
                        </div>
                        {filters.search || filters.showOnlyMismatches || filters.showOnlyNotAttacked ? (
                          <button
                            onClick={() => setFilters({
                              search: "",
                              sort: "pos",
                              thRange: [1, 17],
                              showOnlyMismatches: false,
                              showOnlyNotAttacked: false
                            })}
                            className="mt-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
                          >
                            Limpar Filtros
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Table Footer with Summary */}
          {filteredPairs.length > 0 && (
            <div className="border-t border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                <div className="flex items-center gap-4">
                  <span>
                    Exibindo <span className="font-semibold text-white/80">{filteredPairs.length}</span> de{" "}
                    <span className="font-semibold text-white/80">{data?.pairs.length ?? 0}</span> jogadores
                  </span>
                  {filters.showOnlyNotAttacked && (
                    <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-200">
                      {filteredPairs.filter(p => !p.ourAttack).length} não atacaram
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span>Média de estrelas: <span className="font-semibold text-white/80">{stats.averageStars.toFixed(2)}</span></span>
                  <span>•</span>
                  <span>Destruição média: <span className="font-semibold text-white/80">{stats.totalDestruction.toFixed(1)}%</span></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Stats Cards - Mobile Responsive */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <StatsCard
          title="Média de Estrelas"
          value={stats.averageStars.toFixed(2)}
          icon={Star}
          trend={stats.averageStars >= 2.5 ? "up" : stats.averageStars >= 2 ? "neutral" : "down"}
        />
        <StatsCard
          title="Taxa de Mismatch"
          value={`${stats.thMismatchRate.toFixed(0)}%`}
          subtitle="Diferença ≥2 TH"
          icon={AlertCircle}
          trend={stats.thMismatchRate > 30 ? "down" : "neutral"}
        />
        <StatsCard
          title="Ataques Restantes"
          value={data ? data.teamSize * 2 - (data.pairs.filter(p => p.ourAttack).length ?? 0) : 0}
          subtitle={`de ${(data?.teamSize ?? 0) * 2} total`}
          icon={Target}
          trend="neutral"
        />
        <StatsCard
          title="Eficiência"
          value={`${Math.round((ourStars / Math.max(1, (data?.teamSize ?? 0) * 3)) * 100)}%`}
          subtitle="do máximo possível"
          icon={TrendingUp}
          trend={ourStars > oppStars ? "up" : "down"}
        />
      </div>
    </main>
  );
}