"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Visão Geral" },
    { href: "/wars/attacks", label: "Guerras" },
    { href: "/raids", label: "Raids" },
    { href: "/roster", label: "Membros" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur">
      <div className="max-w-7xl mx-auto h-16 px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo_shivam.png"
            alt="shivam"
            className="h-9 w-9 rounded-lg object-cover shadow-lg shadow-fuchsia-500/20"
          />
          <span className="font-black tracking-wider">shivam</span>
        </Link>

        {/* Links desktop */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
          <a
            href="https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2QLLU89LP"
            target="_blank"
            rel="noopener"
            className="ml-2 inline-flex h-10 items-center rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 font-semibold hover:opacity-95"
          >
            Entrar no clã
          </a>
        </nav>

        {/* Botão hambúrguer mobile */}
        <button
          className="md:hidden p-2 hover:bg-white/10 rounded-lg"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="md:hidden bg-black/95 border-t border-white/10 px-4 py-4 flex flex-col gap-4 text-white/80 text-base">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <a
            href="https://link.clashofclans.com/en/?action=OpenClanProfile&tag=2QLLU89LP"
            target="_blank"
            rel="noopener"
            className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 font-semibold hover:opacity-95"
            onClick={() => setOpen(false)}
          >
            Entrar no clã
          </a>
        </div>
      )}
    </header>
  );
}
