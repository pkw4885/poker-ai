"use client";

import { useState } from "react";
import Link from "next/link";
import HandSelector from "@/components/guide/HandSelector";
import PositionSelector from "@/components/guide/PositionSelector";
import { useI18n, LanguageToggle } from "@/lib/i18n";

// Preflop hand strength tiers
const TIER_1 = ["AA", "KK", "QQ", "AKs"];
const TIER_2 = ["JJ", "TT", "AQs", "AKo", "AQo"];
const TIER_3 = ["99", "88", "77", "AJs", "ATs", "KQs", "KQo"];
const TIER_4_PAIRS = ["66", "55", "44", "33", "22"];

function getHandKey(cards: string[]): string {
  if (cards.length !== 2) return "";
  const [c1, c2] = cards;
  const r1 = c1[0], s1 = c1[1];
  const r2 = c2[0], s2 = c2[1];
  const suited = s1 === s2;

  const ranks = "23456789TJQKA";
  const i1 = ranks.indexOf(r1);
  const i2 = ranks.indexOf(r2);

  const high = i1 >= i2 ? r1 : r2;
  const low = i1 >= i2 ? r2 : r1;

  if (high === low) return `${high}${low}`;
  return `${high}${low}${suited ? "s" : "o"}`;
}

type ReasoningKey =
  | "reason.premium"
  | "reason.strong"
  | "reason.solid.early"
  | "reason.solid.late"
  | "reason.smallpair.early"
  | "reason.smallpair.late"
  | "reason.suited.late"
  | "reason.weak.early"
  | "reason.marginal.late"
  | "reason.weak.blinds"
  | "reason.weak.default";

interface Recommendation {
  action: string;
  confidence: number;
  reasoningKey: ReasoningKey;
  tier: string;
}

function getRecommendation(handKey: string, position: string): Recommendation | null {
  if (!handKey) return null;

  const isPair = handKey.length === 2;
  const isTier1 = TIER_1.includes(handKey);
  const isTier2 = TIER_2.includes(handKey);
  const isTier3 = TIER_3.includes(handKey);
  const isTier4Pair = isPair && TIER_4_PAIRS.includes(handKey);

  const earlyPos = ["UTG", "MP"].includes(position);
  const latePos = ["CO", "BTN"].includes(position);
  const blinds = ["SB", "BB"].includes(position);

  if (isTier1) {
    return {
      action: "RAISE",
      confidence: 0.95,
      reasoningKey: "reason.premium",
      tier: "Premium",
    };
  }
  if (isTier2) {
    return {
      action: "RAISE",
      confidence: 0.85,
      reasoningKey: "reason.strong",
      tier: "Strong",
    };
  }
  if (isTier3) {
    if (earlyPos) {
      return {
        action: "RAISE / CALL",
        confidence: 0.7,
        reasoningKey: "reason.solid.early",
        tier: "Solid",
      };
    }
    return {
      action: "RAISE",
      confidence: 0.8,
      reasoningKey: "reason.solid.late",
      tier: "Solid",
    };
  }
  if (isTier4Pair) {
    if (earlyPos) {
      return {
        action: "CALL / FOLD",
        confidence: 0.55,
        reasoningKey: "reason.smallpair.early",
        tier: "Marginal",
      };
    }
    return {
      action: "RAISE / CALL",
      confidence: 0.65,
      reasoningKey: "reason.smallpair.late",
      tier: "Marginal",
    };
  }

  const suited = handKey.endsWith("s");
  if (suited && latePos) {
    return {
      action: "RAISE / CALL",
      confidence: 0.6,
      reasoningKey: "reason.suited.late",
      tier: "Speculative",
    };
  }

  if (earlyPos) {
    return {
      action: "FOLD",
      confidence: 0.75,
      reasoningKey: "reason.weak.early",
      tier: "Weak",
    };
  }

  if (latePos) {
    return {
      action: "RAISE / FOLD",
      confidence: 0.5,
      reasoningKey: "reason.marginal.late",
      tier: "Marginal",
    };
  }

  return {
    action: "CHECK / FOLD",
    confidence: 0.6,
    reasoningKey: blinds ? "reason.weak.blinds" : "reason.weak.default",
    tier: "Weak",
  };
}

const TIER_STYLES: Record<string, { bar: string; text: string }> = {
  Premium: { bar: "bg-white", text: "text-white" },
  Strong: { bar: "bg-[#00dc82]", text: "text-[#00dc82]" },
  Solid: { bar: "bg-[#3b82f6]", text: "text-[#3b82f6]" },
  Marginal: { bar: "bg-[#fbbf24]", text: "text-[#fbbf24]" },
  Speculative: { bar: "bg-[#f97316]", text: "text-[#f97316]" },
  Weak: { bar: "bg-[#555]", text: "text-[#555]" },
};

export default function GuidePage() {
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [position, setPosition] = useState("BTN");
  const { t } = useI18n();

  const handKey = getHandKey(selectedCards);
  const recommendation = getRecommendation(handKey, position);
  const tierStyle = recommendation ? TIER_STYLES[recommendation.tier] || TIER_STYLES.Weak : null;

  const actionKey = recommendation ? `action.${recommendation.action}` as const : null;
  const tierKey = recommendation ? `tier.${recommendation.tier}` as const : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <Link
          href="/"
          className="text-xs text-[#666] hover:text-white transition-colors uppercase tracking-wider"
        >
          &larr; {t("common.back")}
        </Link>
        <span className="text-xs font-semibold tracking-widest uppercase text-[#444]">
          {t("nav.guide")}
        </span>
        <LanguageToggle />
      </nav>

      <main className="flex flex-col items-center px-4 py-8 md:py-12 gap-8 max-w-xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {t("guide.title")}
          </h1>
          <p className="text-xs text-[#555] mt-2 tracking-wide">
            {t("guide.subtitle")}
          </p>
        </div>

        {/* Position */}
        <div className="w-full">
          <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-3 block">
            {t("guide.position")}
          </label>
          <PositionSelector selected={position} onSelect={setPosition} />
        </div>

        {/* Hand selector */}
        <div className="w-full">
          <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-3 block">
            {t("guide.yourCards")}
          </label>
          <HandSelector selected={selectedCards} onSelect={setSelectedCards} />
        </div>

        {/* Recommendation */}
        {recommendation && selectedCards.length === 2 && tierStyle && (
          <div className="w-full border border-[#222] bg-[#111] p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
                {handKey} &middot; {position}
              </span>
              <span className={`text-[10px] tracking-wider uppercase ${tierStyle.text}`}>
                {tierKey ? t(tierKey) : recommendation.tier}
              </span>
            </div>

            <div className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
              {actionKey ? t(actionKey) : recommendation.action}
            </div>

            <p className="text-xs text-[#666] leading-relaxed mb-4">
              {t(recommendation.reasoningKey)}
            </p>

            {/* Confidence bar */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#555] uppercase tracking-wider">
                {t("common.confidence")}
              </span>
              <div className="flex-1 h-[2px] bg-[#222] relative">
                <div
                  className={`absolute inset-y-0 left-0 ${tierStyle.bar}`}
                  style={{ width: `${recommendation.confidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-[#666] font-mono">
                {Math.round(recommendation.confidence * 100)}%
              </span>
            </div>
          </div>
        )}

        {selectedCards.length < 2 && (
          <div className="text-xs text-[#444] text-center py-8">
            {t("guide.selectPrompt")}
          </div>
        )}
      </main>
    </div>
  );
}
