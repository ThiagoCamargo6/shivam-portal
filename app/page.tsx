'use client';

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sword, Shield, Users, Trophy, CalendarDays, Flame,
  Search, Ticket, Zap, Star, HandCoins, Coins,
  TrendingUp, Activity, Clock, AlertCircle, ChevronRight,
  Sparkles, Target, Award, ArrowUpRight, ArrowDownRight, RefreshCw
} from "lucide-react";

/* =================== Tipos =================== */
interface Member {
  name: string;
  tag: string;
  role: "leader" | "coLeader" | "elder" | "member";
  townHall: number;
  level: number;
  trophies: number;
  donations: number;
}
interface WarSummary {
  opponent: string;
  result: "W" | "L" | "T";
  starsFor: number;
  starsAgainst: number;
  destructionFor: number;
  destructionAgainst: number;
  endedAt: string;
  isLeague?: boolean;
  isCWL?: boolean;
  type?: string;
  kind?: string;
  mode?: string;
}
interface Pair {
  pos: number;
  ours: { name: string; tag: string; th: number } | null;
  opp: { name: string; tag: string; th: number } | null;
  ourAttack: { stars: number; destruction: number; order: number } | null;
  oppAttack: { stars: number; destruction: number; order: number } | null;
}
interface WarStatus {
  state: "notInWar" | "preparation" | "inWar" | "warEnded";
  opponent: string | null;
  starsOur: number;
  starsOpp: number;
  destructionOur: number;
  destructionOpp: number;
  attacks: number;
  maxAttacks: number;
  teamSize: number;
  endsAt: Date | null;
}
interface Clan {
  name: string;
  tag: string;
  description: string;
  type: "inviteOnly" | "closed" | "open";
  location: string;
  warLeague: string;
  clanLevel: number;
  clanPoints: number;
  warWins?: number;
  members: Member[];
}
interface RaidsTotals {
  capitalLoot: number | null;
  attacks: number | null;
  participants: number | null;
}

/* =================== Helpers =================== */
const PT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const PT_DT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });
const NUM = new Intl.NumberFormat("pt-BR");
const COMPACT = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const WAR_MIRROR_PATH = "/wars/attacks";
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const nextWeekday = (from = new Date(), wd: number) => {
  const diff = (wd + 7 - from.getDay()) % 7 || 7;
  return addDays(from, diff);
};
const nextMonthStart = (from = new Date()) => new Date(from.getFullYear(), from.getMonth() + 1, 1, 9, 0, 0, 0);
const nextWeekendSaturday = (from = new Date()) => nextWeekday(from, 6);
const formatPercent = (n: number) => `${n.toFixed(1)}%`;
const roleLabel = (r: Member["role"]) => ({
  leader: "Líder",
  coLeader: "Co-líder",
  elder: "Veterano",
  member: "Membro",
}[r]);

const CLAN_TAG = process.env.NEXT_PUBLIC_CLAN_TAG || "#YOURTAG";
const API_SUMMARY = "/api/portal/summary";
const API_RAIDS = "/api/portal/raids";
const API_WAR_STATUS = "/api/wars/attacks";
const CLAN_ICON_URL = "/logo_shivam.png";
const ROUTINE = { warDays: [2, 5], defaultWarHour: 21 };
const POLLING_INTERVAL = 30000; // 30 segundos

/* TH icon em /public/cv/CV1.png ... /cv/CV17.png */
const thIcon = (th?: number) => `/cv/CV${Math.max(1, Math.min(17, Number(th || 1)))}.png`;

/* Sorteio mensal — dia 06 às 09:00 */
const DRAW_DAY = 6;
const DRAW_HOUR = 9;

/* Hook para Polling de Dados da Guerra */
function useWarData(clanTag: string, enablePolling: boolean = true) {
  const [data, setData] = useState<WarStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const url = `${API_WAR_STATUS}?tag=${encodeURIComponent(clanTag)}&t=${Date.now()}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`War API ${response.status}`);
      const json = await response.json();
      const pairs: Pair[] = json.pairs || [];
      const attackedOurs = pairs.filter(p => p.ourAttack !== null);
      const attackedOpps = pairs.filter(p => p.oppAttack !== null);
      const status: WarStatus = {
        state: json.state || "notInWar",
        opponent: json.opponent?.name || null,
        starsOur: json.totals?.our?.stars ?? pairs.reduce((s, p) => s + (p.ourAttack?.stars ?? 0), 0),
        starsOpp: json.totals?.opp?.stars ?? pairs.reduce((s, p) => s + (p.oppAttack?.stars ?? 0), 0),
        destructionOur: json.totals?.our?.destruction ?? (attackedOurs.length > 0 ? attackedOurs.reduce((s, p) => s + (p.ourAttack?.destruction ?? 0), 0) / attackedOurs.length : 0),
        destructionOpp: json.totals?.opp?.destruction ?? (attackedOpps.length > 0 ? attackedOpps.reduce((s, p) => s + (p.oppAttack?.destruction ?? 0), 0) / attackedOpps.length : 0),
        attacks: json.totals?.our?.attacks ?? attackedOurs.length,
        maxAttacks: (json.teamSize ?? pairs.length) * 2,
        teamSize: json.teamSize ?? pairs.length,
        endsAt: json.endTime ? new Date(json.endTime) : null,
      };
      setData(status);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clanTag]);

  useEffect(() => {
    fetchData();
    if (enablePolling) {
      const interval = setInterval(fetchData, POLLING_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [fetchData, enablePolling]);

  return { data, error, loading, lastUpdate, refetch: fetchData };
}

/* contador regressivo */
function useCountdown(target: Date) {
  const [delta, setDelta] = useState<number>(() => target.getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDelta(target.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const total = Math.max(0, delta);
  const h = Math.floor(total / 3_600_000),
    m = Math.floor((total % 3_600_000) / 60_000),
    s = Math.floor((total % 60_000) / 1000);
  return { h, m, s, total };
}

/* UI */
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)] ${className}`}>{children}</div>;
}

function Badge({ children, tone = "zinc", pulse = false }: { children: React.ReactNode; tone?: "green" | "red" | "zinc" | "amber" | "indigo" | "emerald"; pulse?: boolean }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    red: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
    amber: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
    indigo: "bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/30",
    zinc: "bg-white/10 text-white/80 ring-1 ring-white/10",
  };
  return (
    <span className={`relative px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone]}`}>
      {pulse && <span className="absolute inset-0 rounded-full animate-ping opacity-75 bg-current" />}
      <span className="relative">{children}</span>
    </span>
  );
}

function Button({
  children, className = "", href, onClick
}: { children: React.ReactNode; className?: string; href?: string; onClick?: any; }) {
  const base = "inline-flex items-center justify-center rounded-2xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/20 h-12 px-7 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:opacity-95";
  if (href) return <a href={href} onClick={onClick} className={`${base} ${className}`}>{children}</a>;
  return <button onClick={onClick} className={`${base} ${className}`}>{children}</button>;
}

function StatChip({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string | number; trend?: "up" | "down" | "neutral" }) {
  const trendIcons = {
    up: <ArrowUpRight className="h-3 w-3 text-emerald-400" />,
    down: <ArrowDownRight className="h-3 w-3 text-rose-400" />,
    neutral: null
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:bg-white/[0.06] transition-colors">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-white/60">{label}</div>
        <div className="text-lg font-semibold flex items-center gap-1">
          {value}
          {trend && trendIcons[trend]}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, cta }: { icon: React.ReactNode; title: string; cta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {cta}
    </div>
  );
}

function EventCard({ icon, title, subtitle, children, highlight }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col h-full min-h-[176px] transition-all hover:scale-[1.02] ${
      highlight
        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 shadow-emerald-500/10 shadow-lg"
        : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-start gap-3 mb-2">
        <div className={`h-8 w-8 grid place-items-center rounded-lg ${highlight ? "bg-emerald-500/20" : "bg-white/10"}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-white/60">{subtitle}</div>}
        </div>
      </div>
      <div className="space-y-1.5 mt-1 grow">{children}</div>
    </div>
  );
}

function RosterCard({ m }: { m: Member }) {
  const isTopPlayer = m.donations > 500 || m.trophies > 5000;

  return (
    <div className={`rounded-2xl border p-4 hover:border-white/20 transition-all hover:scale-[1.02] h-full ${
      isTopPlayer ? "border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent" : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl border border-white/10 bg-zinc-900 grid place-items-center overflow-hidden">
          <img src={thIcon(m.townHall)} alt={`TH ${m.townHall}`} className="h-10 w-10 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate flex items-center gap-2">
            {m.name}
            {isTopPlayer && <Sparkles className="h-3 w-3 text-amber-400" />}
          </div>
          <div className="text-xs text-white/60">{m.tag}</div>
        </div>
        <div className="ml-auto"><Badge>{roleLabel(m.role)}</Badge></div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-white/80">
        <div className="inline-flex items-center gap-1">
          <img src={thIcon(m.townHall)} className="h-3.5 w-3.5" alt="" />
          TH {m.townHall}
        </div>
        <div className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5" />
          XP {m.level}
        </div>
        <div className="inline-flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5" />
          {COMPACT.format(m.trophies)}
        </div>
        <div className="inline-flex items-center gap-1">
          <HandCoins className="h-3.5 w-3.5" />
          {COMPACT.format(m.donations)}
        </div>
      </div>
    </div>
  );
}

/* War Status Card Component */
function WarStatusCard({ status, loading, refetch }: { status: WarStatus | null; loading: boolean; refetch: () => void }) {
  const countdown = useCountdown(status?.endsAt || new Date());

  const getStatusColor = () => {
    if (!status) return "bg-zinc-500";
    switch (status.state) {
      case "inWar": return "bg-emerald-500";
      case "preparation": return "bg-amber-500";
      case "warEnded": return "bg-sky-500";
      default: return "bg-zinc-500";
    }
  };

  const getStatusLabel = () => {
    if (!status) return "Carregando...";
    switch (status.state) {
      case "inWar": return "EM GUERRA";
      case "preparation": return "PREPARAÇÃO";
      case "warEnded": return "FINALIZADA";
      default: return "SEM GUERRA";
    }
  };

  const isActive = status?.state === "inWar" || status?.state === "preparation";
  const isWinning = (status?.starsOur || 0) > (status?.starsOpp || 0);
  const isTied = (status?.starsOur || 0) === (status?.starsOpp || 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-24 mb-3" />
        <div className="h-6 bg-white/10 rounded w-full mb-2" />
        <div className="h-4 bg-white/10 rounded w-32" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 relative overflow-hidden transition-all hover:scale-[1.01] ${
        isActive
          ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-violet-500/10 shadow-lg"
          : "border-white/10 bg-white/5"
      }`}
    >
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent animate-pulse" />
      )}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor()} ${isActive ? "animate-pulse" : ""}`} />
          <span className="text-xs font-bold tracking-wider text-white/60">
            {getStatusLabel()}
          </span>
        </div>
        {isActive && countdown.total > 0 && (
          <div className="flex items-center gap-1 text-xs text-white/60">
            <Clock className="h-3 w-3" />
            <span className="font-mono">
              {countdown.h.toString().padStart(2, "0")}:
              {countdown.m.toString().padStart(2, "0")}:
              {countdown.s.toString().padStart(2, "0")}
            </span>
          </div>
        )}
      </div>
      {status?.opponent ? (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-sm font-semibold truncate">Shivam Clan</div>
            <div className="text-xs text-white/40">VS</div>
            <div className="text-sm font-semibold truncate text-right">{status.opponent}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-3 text-center ${
              isWinning && !isTied ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/5 border border-white/10"
            }`}>
              <div className="text-2xl font-black tabular-nums flex items-center justify-center gap-1">
                {status.starsOur}
                {isWinning && !isTied && <Trophy className="h-4 w-4 text-emerald-400" />}
              </div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider mt-1">Nossas ★</div>
              <div className="text-xs text-white/50 mt-4">{status.destructionOur.toFixed(1)}%</div>
            </div>
            <div className={`rounded-xl p-3 text-center ${
              !isWinning && !isTied ? "bg-rose-500/10 border border-rose-500/20" : "bg-white/5 border border-white/10"
            }`}>
              <div className="text-2xl font-black tabular-nums">
                {status.starsOpp}
              </div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider mt-1">Deles ★</div>
              <div className="text-xs text-white/50 mt-4">{status.destructionOpp.toFixed(1)}%</div>
            </div>
          </div>
          {isActive && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-white/60">
                <span>Ataques realizados</span>
                <span className="font-medium">{status.attacks}/{status.maxAttacks}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${(status.attacks / status.maxAttacks) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={refetch}
              className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-white/40">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">Sem guerra ativa no momento</div>
        </div>
      )}
    </motion.div>
  );
}

/* Skeleton */
const Sk = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />;

/* ========= Sorteio mensal ========= */
function mulberry32(seed: number) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWinnerForDate(members: Member[], date: Date) {
  const eligible = members.filter(m => (m.townHall ?? 0) >= 9);
  if (!eligible.length) return null;
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const seed = [...key + CLAN_TAG].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = mulberry32(seed)();
  return eligible[Math.floor(rnd * eligible.length)]!;
}

/* ========= Página ========= */
export default function Page() {
  const [clan, setClan] = useState<Clan | null>(null);
  const [wars, setWars] = useState<WarSummary[] | null>(null);
  const [raidsTotals, setRaidsTotals] = useState<RaidsTotals | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [roleFilter, setRoleFilter] = useState<"all" | Member["role"]>("all");
  const [sortKey, setSortKey] = useState<"trophies" | "donations" | "townHall" | "level">("trophies");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: warStatus, loading: warStatusLoading, error: warStatusError, refetch } = useWarData(CLAN_TAG);

  const nextTue = nextWeekday(new Date(), ROUTINE.warDays[0]);
  const nextFri = nextWeekday(new Date(), ROUTINE.warDays[1]);
  const nextRaid = nextWeekendSaturday();
  const nextLeague = nextMonthStart();

  useEffect(() => {
    const url = `${API_SUMMARY}?tag=${encodeURIComponent(CLAN_TAG)}&t=${Date.now()}`;
    fetch(url, { cache: "no-store" })
      .then(async r => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data?.clan) setClan(data.clan as Clan);
        if (Array.isArray(data?.wars)) setWars(data.wars as WarSummary[]);
      })
      .catch(console.warn);
  }, []);

  useEffect(() => {
    const url = `${API_RAIDS}?tag=${encodeURIComponent(CLAN_TAG)}&t=${Date.now()}`;
    fetch(url, { cache: "no-store" })
      .then(async r => {
        if (!r.ok) throw new Error(`RAIDS ${r.status}`);
        return r.json();
      })
      .then((data: any) => {
        const totals = data?.totals ?? data?.summary?.totals ?? data?.raid?.totals ?? null;
        let capitalLoot: number | null = totals?.capitalLoot ?? totals?.capital_loot ?? totals?.capital ?? null;
        let attacks: number | null = totals?.attacks ?? totals?.total_attacks ?? null;
        let participants: number | null = totals?.participants ?? totals?.members ?? null;

        if ((capitalLoot == null || Number.isNaN(capitalLoot)) && Array.isArray(data?.entries)) {
          capitalLoot = data.entries.reduce((sum: number, e: any) => sum + (e?.capitalLoot ?? e?.capital_loot ?? 0), 0);
        }

        setRaidsTotals({
          capitalLoot: (typeof capitalLoot === "number" ? capitalLoot : null),
          attacks: (typeof attacks === "number" ? attacks : null),
          participants: (typeof participants === "number" ? participants : null),
        });
      })
      .catch(() => setRaidsTotals({ capitalLoot: null, attacks: null, participants: null }));
  }, []);

  const roster = useMemo(() => {
    const list = clan?.members ?? [];
    let arr = [...list];
    if (query) {
      const q = query.toLowerCase();
      arr = arr.filter(m => m.name.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q) || roleLabel(m.role).toLowerCase().includes(q));
    }
    if (roleFilter !== "all") arr = arr.filter(m => m.role === roleFilter);
    arr.sort((a, b) => {
      const A = (a as any)[sortKey], B = (b as any)[sortKey];
      if (A === B) return 0;
      return sortDir === "asc" ? (A > B ? 1 : -1) : (A < B ? 1 : -1);
    });
    return arr;
  }, [clan?.members, query, roleFilter, sortKey, sortDir]);

  const isLeagueWar = (w: Partial<WarSummary>) => {
    const t = (w.type || w.kind || w.mode || "").toLowerCase();
    return w.isLeague === true || w.isCWL === true || t.includes("league") || t.includes("cwl");
  };

  const warsOnly = useMemo(() => (wars ?? []).filter(w => !isLeagueWar(w)), [wars]);

  const winStreak = useMemo(() => {
    if (!warsOnly.length) return 0;
    const sorted = [...warsOnly].sort((a, b) => +new Date(b.endedAt) - +new Date(a.endedAt));
    let c = 0;
    for (const w of sorted) {
      if (w.result === "W") c++;
      else break;
    }
    return c;
  }, [warsOnly]);

  const winsTotal = useMemo(() => {
    if (clan?.warWins != null) return clan.warWins;
    return warsOnly.filter(w => w.result === "W").length;
  }, [clan?.warWins, warsOnly]);

  const totalDonations = useMemo(
    () => clan?.members?.reduce((sum, m) => sum + (m.donations || 0), 0) ?? 0,
    [clan?.members]
  );

  const topDonator = useMemo(() => {
    if (!clan?.members?.length) return null;
    return [...clan.members].sort((a, b) => b.donations - a.donations)[0];
  }, [clan?.members]);

  const topTrophy = useMemo(() => {
    if (!clan?.members?.length) return null;
    return [...clan.members].sort((a, b) => b.trophies - a.trophies)[0];
  }, [clan?.members]);

  // Nova métrica: Média de Estrelas por Guerra
  const avgStarsPerWar = useMemo(() => {
    if (!warsOnly.length) return 0;
    const totalStars = warsOnly.reduce((sum, w) => sum + w.starsFor, 0);
    return (totalStars / warsOnly.length).toFixed(1);
  }, [warsOnly]);

  return (
    <main className="min-h-screen text-white relative">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_10%_0%,rgba(139,92,246,0.2),transparent),radial-gradient(60%_50%_at_90%_0%,rgba(236,72,153,0.15),transparent)]" />
      </div>

      <section id="top" className="max-w-7xl mx-auto px-4 pt-10 pb-8">
        <GlassCard className="p-6 md:p-10 overflow-hidden relative">
          <div aria-hidden className="pointer-events-none absolute -inset-6 bg-[radial-gradient(40%_60%_at_80%_0%,rgba(139,92,246,0.15),transparent)]" />
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-10 space-y-5"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                <Zap className="h-3.5 w-3.5" />
                Foco em WAR & Evolução
              </div>
              <h1 className="text-4xl md:text-6xl font-black leading-[1.05]">
                {clan?.name ?? "Shivam"} <span className="text-fuchsia-400">Clan</span>
              </h1>
              <p className="text-white/70 text-lg max-w-xl">
                Guerras frequentes e organizadas · Doações ativas · Participação garantida em ligas CV 14+
              </p>
              <WarStatusCard status={warStatus} loading={warStatusLoading} refetch={refetch} />
              {warStatusError && (
                <div className="text-sm text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Erro ao carregar dados da guerra: {warStatusError}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Badge tone="indigo">Aceitamos CV9+</Badge>
                <Badge tone="green" pulse={winStreak > 3}>Vitórias seguidas: {winStreak}</Badge>
                {warStatus?.state === "inWar" && <Badge tone="emerald" pulse>Guerra Ativa!</Badge>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <StatChip
                  icon={<Users className="h-4 w-4" />}
                  label="Membros"
                  value={clan ? `${clan.members.length}/50` : "—"}
                  trend={clan && clan.members.length > 45 ? "up" : clan && clan.members.length < 30 ? "down" : "neutral"}
                />
                <StatChip icon={<Trophy className="h-4 w-4" />} label="Liga" value={clan?.warLeague || "—"} />
                <StatChip icon={<Shield className="h-4 w-4" />} label="Nível do Clã" value={clan?.clanLevel ?? "—"} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatChip
                  icon={<HandCoins className="h-4 w-4" />}
                  label="Doações totais"
                  value={COMPACT.format(totalDonations)}
                  trend={totalDonations > 10000 ? "up" : "neutral"}
                />
                <StatChip
                  icon={<Sword className="h-4 w-4" />}
                  label="Guerras vencidas"
                  value={winsTotal > 0 ? `${winsTotal}+` : "—"}
                  trend={winStreak > 0 ? "up" : "neutral"}
                />
                <StatChip
                  icon={<Coins className="h-4 w-4" />}
                  label="Capital Total"
                  value={raidsTotals?.capitalLoot ? COMPACT.format(raidsTotals.capitalLoot) : "—"}
                />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.05 }} className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-gradient-to-br from-fuchsia-600/25 to-violet-600/25 blur-2xl" />
              <div className="relative space-y-3">
                <div className="aspect-square rounded-[28px] border border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900 p-6 flex items-center justify-center shadow-2xl">
                  <img src={CLAN_ICON_URL} alt="Logo do clã" className="w-full h-full object-contain drop-shadow-[0_0_45px_rgba(191,90,242,0.45)]" />
                </div>
                {topDonator && (
                  <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-amber-500/10 backdrop-blur px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-400" />
                        <div>
                          <div className="text-xs text-amber-200/80">Top Doador</div>
                          <div className="text-sm font-semibold">{topDonator.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-200">{COMPACT.format(topDonator.donations)}</div>
                        <div className="text-xs text-amber-200/60">doações</div>
                      </div>
                    </div>
                  </div>
                )}
                {topTrophy && (
                  <div className="rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/20 to-violet-500/10 backdrop-blur px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-violet-400" />
                        <div>
                          <div className="text-xs text-violet-200/80">Top Troféus</div>
                          <div className="text-sm font-semibold">{topTrophy.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-violet-200">{COMPACT.format(topTrophy.trophies)}</div>
                        <div className="text-xs text-violet-200/60">troféus</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </GlassCard>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              <span className="text-xs text-emerald-200/60">24h</span>
            </div>
            <div className="text-2xl font-bold text-emerald-200">{warStatus?.attacks || 0}</div>
            <div className="text-xs text-white/60">Ataques realizados</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-transparent p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-violet-400" />
              <Trophy className="h-4 w-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-violet-200">{avgStarsPerWar || "0"}</div>
            <div className="text-xs text-white/60">Média de Estrelas por Guerra</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-transparent p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-amber-400" />
              <span className="text-xs text-amber-200/60">Média</span>
            </div>
            <div className="text-2xl font-bold text-amber-200">
              {warStatus?.attacks ? ((warStatus?.starsOur || 0) / warStatus.attacks).toFixed(1) : "0"}
            </div>
            <div className="text-xs text-white/60">Estrelas por ataque</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-sky-500/10 to-transparent p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <Sparkles className="h-5 w-5 text-sky-400" />
              <span className="text-xs text-sky-200/60">Total</span>
            </div>
            <div className="text-2xl font-bold text-sky-200">{clan?.clanPoints ? COMPACT.format(clan.clanPoints) : "—"}</div>
            <div className="text-xs text-white/60">Pontos do Clã</div>
          </motion.div>
        </div>
      </section>

      <section id="overview" className="max-w-7xl mx-auto px-4 pb-10 scroll-mt-24">
        <GlassCard id="events" className="p-6 h-full flex flex-col">
          <SectionHeader
            icon={<CalendarDays className="h-5 w-5" />}
            title="Rotina & Próximos Eventos"
            cta={
              <Link href="/wars/attacks" className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
                <Sword className="h-4 w-4" />
                Espelho da Guerra
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <EventCard
              icon={<Shield className="h-4 w-4" />}
              title="Guerras"
              subtitle={`Ter & Sex • ${ROUTINE.defaultWarHour}:00`}
              highlight={warStatus?.state === "inWar"}
            >
              <div className="flex items-center justify-between">
                <span>Próxima terça</span>
                <span className="text-white/80">{WEEKDAYS_PT[nextTue.getDay()]} • {PT.format(nextTue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Próxima sexta</span>
                <span className="text-white/80">{WEEKDAYS_PT[nextFri.getDay()]} • {PT.format(nextFri)}</span>
              </div>
              {warStatus?.state === "inWar" && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-xs text-emerald-200">Guerra em andamento!</div>
                </div>
              )}
            </EventCard>
            <EventCard icon={<Flame className="h-4 w-4" />} title="Raid da Capital" subtitle="Todo fim de semana">
              <div className="flex items-center justify-between">
                <span>Próximo raid</span>
                <span className="text-white/80">Sáb • {PT.format(nextRaid)}</span>
              </div>
              {raidsTotals?.participants && (
                <div className="mt-2">
                  <div className="text-xs text-white/60">Último raid: {raidsTotals.participants} participantes</div>
                </div>
              )}
            </EventCard>
            <EventCard icon={<Trophy className="h-4 w-4" />} title="Liga de Guerra" subtitle="Início do mês">
              <div className="flex items-center justify-between">
                <span>Próxima liga</span>
                <span className="text-white/80">{PT.format(nextLeague)}</span>
              </div>
              <div className="text-xs text-white/60 mt-2">Liga: {clan?.warLeague || "—"}</div>
            </EventCard>
            <EventCard icon={<Ticket className="h-4 w-4" />} title="Bilhete Dourado" subtitle="Sorteio dia 06 • 09:00">
              <div className="text-sm text-white/60">Todos CV9+ participam</div>
              <div className="text-xs text-white/50">Sorteio às {DRAW_HOUR.toString().padStart(2, "0")}:00</div>
              {clan?.members && (
                <div className="mt-2">
                  <div className="text-xs text-amber-200">
                    {clan.members.filter(m => m.townHall >= 9).length} elegíveis
                  </div>
                </div>
              )}
            </EventCard>
          </div>
        </GlassCard>
      </section>

      <section id="wars" className="max-w-7xl mx-auto px-4 pb-10 scroll-mt-24">
        <GlassCard className="p-6">
          <SectionHeader
            icon={<Sword className="h-5 w-5" />}
            title="Histórico de Guerras"
            cta={
              <div className="flex items-center gap-2">
                <Badge tone={winStreak > 0 ? "green" : "zinc"}>
                  {winStreak > 0 ? `${winStreak} vitórias seguidas` : "Sem sequência"}
                </Badge>
                <Badge>Total: {warsOnly.length}</Badge>
              </div>
            }
          />
          {!wars ? (
            <div className="grid gap-2">
              <Sk className="h-8 w-full" />
              <Sk className="h-8 w-11/12" />
              <Sk className="h-8 w-10/12" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/60 border-b border-white/10">
                    <th className="py-2 pr-4 text-left">Oponente</th>
                    <th className="py-2 pr-4 text-left">Resultado</th>
                    <th className="py-2 pr-4 text-left">★ Estrelas</th>
                    <th className="py-2 pr-4 text-left">Destruição</th>
                    <th className="py-2 pr-4 text-left">Encerramento</th>
                  </tr>
                </thead>
                <tbody>
                  {warsOnly.slice(0, 10).map((w, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4 font-medium">{w.opponent}</td>
                      <td className="py-3 pr-4">
                        {w.result === "W" ? <Badge tone="green">Vitória</Badge> : w.result === "L" ? <Badge tone="red">Derrota</Badge> : <Badge>Empate</Badge>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={w.starsFor > w.starsAgainst ? "text-emerald-400" : w.starsFor < w.starsAgainst ? "text-rose-400" : ""}>
                          {w.starsFor} — {w.starsAgainst}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={w.destructionFor > w.destructionAgainst ? "text-emerald-400" : w.destructionFor < w.destructionAgainst ? "text-rose-400" : ""}>
                          {formatPercent(w.destructionFor)} — {formatPercent(w.destructionAgainst)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-white/70">{new Date(w.endedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </section>

      <section id="roster" className="max-w-7xl mx-auto px-4 pb-16 scroll-mt-24">
        <GlassCard className="p-6">
          <SectionHeader
            icon={<Users className="h-5 w-5" />}
            title="Membros do Clã"
            cta={
              <div className="flex items-center gap-2">
                <button onClick={() => setView("cards")} className={`h-10 px-3 rounded-xl border text-xs transition-colors ${view === "cards" ? "bg-white text-black" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>Cards</button>
                <button onClick={() => setView("table")} className={`h-10 px-3 rounded-xl border text-xs transition-colors ${view === "table" ? "bg-white text-black" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>Tabela</button>
              </div>
            }
          />
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nome, tag ou cargo..."
                className="w-full pl-9 pr-3 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm outline-none focus:bg-white/10 focus:border-white/20 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "leader", "coLeader", "elder", "member"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r as any)}
                  className={`h-10 px-4 rounded-xl border text-xs transition-colors ${roleFilter === r ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 border-transparent" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                >
                  {r === "all" ? "Todos" : roleLabel(r as any)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-xs cursor-pointer"
              >
                <option value="trophies">Troféus</option>
                <option value="donations">Doações</option>
                <option value="townHall">TH</option>
                <option value="level">Nível</option>
              </select>
              <button
                onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition-colors"
              >
                {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>
          {!clan ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Sk className="h-10 w-1/2 mb-3" />
                  <Sk className="h-4 w-full mb-1" />
                  <Sk className="h-4 w-5/6" />
                </div>
              ))}
            </div>
          ) : view === "cards" ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {roster.map((m) => <RosterCard key={m.tag} m={m} />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/60 border-b border-white/10">
                    <th className="py-2 pr-4 text-left">Jogador</th>
                    <th className="py-2 pr-4 text-left">Cargo</th>
                    <th className="py-2 pr-4 text-left">TH</th>
                    <th className="py-2 pr-4 text-left">Nível</th>
                    <th className="py-2 pr-4 text-left">Troféus</th>
                    <th className="py-2 pr-4 text-left">Doações</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(m => (
                    <tr key={m.tag} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-medium flex items-center gap-2">
                          {m.name}
                          {(m.donations > 500 || m.trophies > 5000) && <Sparkles className="h-3 w-3 text-amber-400" />}
                        </div>
                        <div className="text-xs text-white/60">{m.tag}</div>
                      </td>
                      <td className="py-3 pr-4"><Badge>{roleLabel(m.role)}</Badge></td>
                      <td className="py-3 pr-4">
                        <div className="inline-flex items-center gap-2">
                          <img src={thIcon(m.townHall)} alt="" className="h-5 w-5" />
                          {m.townHall}
                        </div>
                      </td>
                      <td className="py-3 pr-4">{m.level}</td>
                      <td className="py-3 pr-4">{COMPACT.format(m.trophies)}</td>
                      <td className="py-3 pr-4">
                        <div className="inline-flex items-center gap-2">
                          <HandCoins className="h-4 w-4" />
                          {COMPACT.format(m.donations)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </section>

      <section id="recruit" className="max-w-7xl mx-auto px-4 pb-20 scroll-mt-24">
        <GlassCard className="p-6 md:p-8 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5">
          <SectionHeader icon={<Ticket className="h-5 w-5" />} title="Junte-se a Nós!" />
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-white/70 mb-2">
                Procuramos jogadores <strong className="text-white">CV9+</strong> com foco em guerra e evolução contínua.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge tone="emerald">Guerra 2x/semana</Badge>
                <Badge tone="amber">Liga de Guerra</Badge>
                <Badge tone="indigo">Raids ativos</Badge>
              </div>
            </div>
            <a
              href="https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2QLLU89LP"
              target="_blank"
              rel="noopener"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 font-semibold hover:opacity-95 transition-opacity"
            >
              Entrar no Clã
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </GlassCard>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-white/40">
          © 2025 {clan?.name || "Shivam Clan"} • Clash of Clans
        </div>
      </footer>
    </main>
  );
}