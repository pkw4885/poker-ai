"use client";

import Link from "next/link";
import { useI18n, LanguageToggle } from "@/lib/i18n";

export default function Home() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <span className="text-sm font-semibold tracking-widest uppercase text-white">
          Poker AI
        </span>
        <div className="flex items-center gap-6 text-xs text-[#666] uppercase tracking-wider">
          <Link href="/guide" className="hover:text-white transition-colors">
            {t("nav.guide")}
          </Link>
          <Link href="/play" className="hover:text-white transition-colors">
            {t("nav.play")}
          </Link>
          <Link href="/rooms" className="hover:text-white transition-colors">
            Rooms
          </Link>
          <Link href="/auth" className="hover:text-white transition-colors">
            Login
          </Link>
          <LanguageToggle />
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-col items-center justify-center px-6 pt-24 pb-16 md:pt-40 md:pb-24">
        <p className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-[#555] mb-4">
          {t("home.subtitle")}
        </p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-3">
          {t("home.title")}
        </h1>
        <p className="text-sm md:text-base text-[#666] mb-16 text-center max-w-md">
          {t("home.tagline")}
        </p>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
          <Link
            href="/guide"
            className="group flex flex-col p-6 md:p-8 bg-[#111] border border-[#222] hover:border-[#444] transition-all"
          >
            <span className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-4">
              01
            </span>
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-[#00dc82] transition-colors">
              {t("home.card1.title")}
            </h2>
            <p className="text-xs text-[#666] leading-relaxed">
              {t("home.card1.desc")}
            </p>
          </Link>

          <Link
            href="/play"
            className="group flex flex-col p-6 md:p-8 bg-[#111] border border-[#222] hover:border-[#444] transition-all"
          >
            <span className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-4">
              02
            </span>
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-[#00dc82] transition-colors">
              {t("home.card2.title")}
            </h2>
            <p className="text-xs text-[#666] leading-relaxed">
              {t("home.card2.desc")}
            </p>
          </Link>

          <div className="group flex flex-col p-6 md:p-8 bg-[#111] border border-[#1a1a1a] opacity-40 cursor-not-allowed">
            <span className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-4">
              03
            </span>
            <h2 className="text-lg font-semibold text-white mb-2">
              {t("home.card3.title")}
            </h2>
            <p className="text-xs text-[#666] leading-relaxed">
              {t("home.card3.desc")}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto px-6 py-6 border-t border-[#111] text-center">
        <p className="text-[10px] text-[#444] tracking-wider uppercase">
          {t("home.footer")}
        </p>
      </footer>
    </div>
  );
}
