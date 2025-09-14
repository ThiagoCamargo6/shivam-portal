"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Users, Search, ArrowUpDown, ChevronLeft } from "lucide-react";

type Member = {
  name: string;
  tag: string;
  role: "leader" | "coLeader" | "elder" | "member";
  townHall: number;
  level: number;
  trophies: number;
  donations: number;
};
type Clan = { name: string; members: Member[] };

const CLAN_TAG = process.env.NEXT_PUBLIC_CLAN_TAG || "#YOURTAG";

function roleLabel(r: Member["role"]) {
  return { leader: "Líder", coLeader: "Co-líder", elder: "Veterano", member: "Membro" }[r];
}
function thTone(th?: number) {
  if (!th) return "bg-white/10 text-white/70";
  if (th >= 15) return "bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/30";
  if (th >= 13) return "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30";
  if (th >= 11) return "bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/30";
  return "bg-zinc-700/30 text-zinc-200 ring-1 ring-zinc-500/30";
}
function thIcon(th?: number) {
  const n = Math.max(1, Math.min(17, Number(th) || 1));
  return `/cv/CV${n}.png`;
}

export default function RosterPage() {
  const [clan, setClan] = useState<Clan | null>(null);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] =
    useState<"trophies" | "donations" | "townHall" | "level">("trophies");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch(`/api/portal/summary?tag=${encodeURIComponent(CLAN_TAG)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.text())))
      .then((j) => setClan(j.clan))
      .catch(() => setClan(null));
  }, []);

  const list = useMemo(() => {
    let arr = [...(clan?.members || [])];
    if (q) {
      const s = q.toLowerCase();
      arr = arr.filter(
        (m) =>
          m.name.toLowerCase().includes(s) ||
          m.tag.toLowerCase().includes(s) ||
          roleLabel(m.role).toLowerCase().includes(s)
      );
    }
    arr.sort((a: any, b: any) => {
      const A = a[sortKey],
        B = b[sortKey];
      if (A === B) return 0;
      return sortDir === "asc" ? (A > B ? 1 : -1) : (A < B ? 1 : -1);
    });
    return arr;
  }, [clan?.members, q, sortKey, sortDir]);

  return (
    <main className="min-h-screen bg-[#0b0b10] text-white">
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-16">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Link>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Users className="h-6 w-6" /> Membros
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, tag ou cargo..."
              className="w-full pl-9 pr-3 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm outline-none focus:bg-white/10"
            />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm"
          >
            <ArrowUpDown className="h-4 w-4" /> {sortDir === "asc" ? "Asc" : "Desc"}
          </button>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-sm"
          >
            <option value="trophies">Troféus</option>
            <option value="donations">Doações</option>
            <option value="townHall">TH</option>
            <option value="level">Nível</option>
          </select>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((m) => (
            <div
              key={m.tag}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.06] transition"
            >
              <div className="flex items-center gap-4">
                {/* Avatar agora mostra o CV no mesmo quadrado */}
                <div className="h-12 w-12 rounded-xl border border-white/10 bg-zinc-900 overflow-hidden grid place-items-center">
                  <Image
                    src={thIcon(m.townHall)}
                    alt={`CV ${m.townHall}`}
                    width={48}
                    height={48}
                    className="h-full w-full object-contain p-1"
                    priority={false}
                  />
                </div>

                <div className="min-w-0">
                  <div className="font-semibold truncate">{m.name}</div>
                  <div className="text-xs text-white/60">{m.tag}</div>
                </div>

                <div className="ml-auto text-xs rounded-full border border-white/10 bg-white/10 px-2 py-1">
                  {roleLabel(m.role)}
                </div>
              </div>

              {/* Stats — removemos o mini ícone aqui; mantemos apenas o chip TH */}
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-white/80 items-center">
                <div className={`px-2 py-1 rounded ${thTone(m.townHall)} ring-1 text-center`}>
                  TH {m.townHall}
                </div>
                <div>XP {m.level}</div>
                <div>🏆 {m.trophies}</div>
                <div>Doações {m.donations}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
