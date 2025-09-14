"use client";
import { ReactNode } from "react";

export function GlassCard({ children, className="" }:{children:ReactNode; className?:string}) {
  return <div className={`rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)] ${className}`}>{children}</div>;
}
export function Badge({ children, tone="zinc" }:{children:ReactNode; tone?: "green"|"red"|"zinc"|"amber"|"indigo"}) {
  const tones:Record<string,string>={
    green:"bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    red:"bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
    amber:"bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
    indigo:"bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/30",
    zinc:"bg-white/10 text-white/80 ring-1 ring-white/10",
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
export function Button({
  children, variant="primary", className="", as="button", href, onClick
}:{
  children:ReactNode; variant?: "primary"|"outline"; className?:string;
  as?: "button"|"a"; href?:string; onClick?: any;
}) {
  const base="inline-flex items-center justify-center rounded-2xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/20 h-12 px-7";
  const style=variant==="primary" ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:opacity-95" : "border border-white/15 bg-white/5 hover:bg-white/10";
  if(as==="a" && href) return <a href={href} onClick={onClick} className={`${base} ${style} ${className}`}>{children}</a>;
  return <button onClick={onClick} className={`${base} ${style} ${className}`}>{children}</button>;
}
export function SectionHeader({icon,title,cta}:{icon:ReactNode; title:string; cta?:ReactNode}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">{icon}<h2 className="text-lg font-semibold">{title}</h2></div>
      {cta}
    </div>
  );
}
