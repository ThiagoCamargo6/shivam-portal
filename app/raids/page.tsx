'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Shield, Trophy, Clock } from 'lucide-react';

/* =================== Tipos =================== */
interface RaidMember {
  tag: string;
  name: string;
  attacks: number;
  attackLimit: number;
  bonusAttackLimit: number;
  capitalResourcesLooted: number;
}
interface RaidEntry {
  state: 'ongoing' | 'ended';
  startTime: string;
  endTime: string;
  capitalTotalLoot: number;
  raidsCompleted: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  offensiveReward: number;
  defensiveReward: number;
  members: RaidMember[];
}
interface ApiResponse {
  raid: RaidEntry | null;
}

/* =================== Config & helpers =================== */
const API_RAIDS = '/api/portal/raids';
const CLAN_TAG = process.env.NEXT_PUBLIC_CLAN_TAG || '#YOURTAG';
const PT_DT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

function parseSupercellTime(s?: string | null): Date | null {
  if (!s) return null;
  try {
    const y = Number(s.slice(0, 4));
    const mo = Number(s.slice(4, 6)) - 1;
    const d = Number(s.slice(6, 8));
    const h = Number(s.slice(9, 11));
    const mi = Number(s.slice(11, 13));
    const se = Number(s.slice(13, 15));
    return new Date(Date.UTC(y, mo, d, h, mi, se));
  } catch {
    return null;
  }
}

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = target ? Math.max(0, target.getTime() - now) : 0;
  const totalSeconds = Math.floor(diff / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s, total: diff };
}

const fmtNum = (n: number) => n.toLocaleString('pt-BR');

/* =================== UI bits =================== */
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-xl shadow-lg ${className}`}>
      {children}
    </div>
  );
}
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}
const Sk = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />
);

/* =================== Página RAIDS =================== */
export default function RaidsPage() {
  const [raid, setRaid] = useState<RaidEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = `${API_RAIDS}?tag=${encodeURIComponent(CLAN_TAG)}&t=${Date.now()}`;
    fetch(url, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then((data) => setRaid(data.raid ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const startAt = parseSupercellTime(raid?.startTime);
  const endAt = parseSupercellTime(raid?.endTime);
  const isOngoing = raid?.state === 'ongoing' && endAt && Date.now() < endAt.getTime();
  const { h, m, s } = useCountdown(isOngoing ? endAt : null);

  const pad = (x: number) => x.toString().padStart(2, '0');
  const countdownText = isOngoing ? `${pad(h)}H:${pad(m)}M:${pad(s)}S` : '—';

  const maxGold = useMemo(
    () => (raid?.members || []).reduce((mx, r) => Math.max(mx, r.capitalResourcesLooted), 0),
    [raid?.members]
  );

  return (
    <main className="min-h-screen text-white relative">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_10%_0%,rgba(139,92,246,0.2),transparent),radial-gradient(60%_50%_at_90%_0%,rgba(236,72,153,0.15),transparent)]" />
      </div>

      <section className="max-w-7xl mx-auto px-4 pt-8 pb-6">
        <h1 className="text-3xl font-black mb-6 flex items-center gap-3">
          <img src="/coin.png" alt="" className="h-8 w-8" />
          Raids da Capital
        </h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <GlassCard className="p-5">
            <div className="text-sm text-white/60">Total atual</div>
            <div className="mt-1 flex items-center gap-2">
              <img src="/coin.png" className="h-6 w-6" alt="" />
              <div className="text-2xl font-extrabold tabular-nums">
                {raid ? fmtNum(raid.capitalTotalLoot) : '—'}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="text-sm text-white/60">Raids concluídas</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">
              {raid ? raid.raidsCompleted : '—'}
            </div>
            <div className="text-xs text-white/50 mt-1">
              Distritos destruídos: {raid ? raid.enemyDistrictsDestroyed : '—'}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="text-sm text-white/60 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Raid atual termina em
            </div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{countdownText}</div>
            <div className="text-xs text-white/50 mt-1">
              {startAt && <>Início: {PT_DT.format(startAt)} • </>}
              {endAt && <>Fim: {PT_DT.format(endAt)}</>}
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Top 10 */}
      <section className="max-w-7xl mx-auto px-4 pb-6">
        <GlassCard className="p-6">
          <SectionHeader icon={<Trophy className="h-5 w-5" />} title="Top 10 — Capital Obtida" />
          {!raid ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Sk key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {raid.members
                .slice()
                .sort((a, b) => b.capitalResourcesLooted - a.capitalResourcesLooted)
                .slice(0, 10)
                .map((row, idx) => {
                  const pct = maxGold ? Math.max(4, Math.round((row.capitalResourcesLooted / maxGold) * 100)) : 0;
                  return (
                    <div key={row.tag} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{idx + 1}. {row.name}</div>
                          <div className="text-xs text-white/60">
                            {row.attacks} ataques
                          </div>
                        </div>
                        <div className="ml-auto inline-flex items-center gap-1 font-semibold tabular-nums">
                          <img src="/coin.png" className="h-4 w-4" alt="" />
                          {fmtNum(row.capitalResourcesLooted)}
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-fuchsia-600 to-violet-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </GlassCard>
      </section>

      {/* Lista completa */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <GlassCard className="p-6">
          <SectionHeader icon={<Shield className="h-5 w-5" />} title="Todos os participantes" />
          {!raid ? (
            <div className="grid gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Sk key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/60 border-b border-white/10">
                    <th className="py-2 pr-4 text-left">Jogador</th>
                    <th className="py-2 pr-4 text-left">Ataques</th>
                    <th className="py-2 pr-4 text-left">Capital</th>
                    <th className="py-2 pr-4 text-left">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {raid.members
                    .slice()
                    .sort((a, b) => b.capitalResourcesLooted - a.capitalResourcesLooted)
                    .map(row => (
                      <tr key={row.tag} className="border-b border-white/5">
                        <td className="py-3 pr-4">{row.name}</td>
                        <td className="py-3 pr-4">{row.attacks}</td>
                        <td className="py-3 pr-4 inline-flex items-center gap-1">
                          <img src="/coin.png" className="h-4 w-4" alt="" />
                          <span className="tabular-nums">{fmtNum(row.capitalResourcesLooted)}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="tabular-nums">
                            {fmtNum(Math.round(row.capitalResourcesLooted / Math.max(1, row.attacks)))}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </section>
    </main>
  );
}
