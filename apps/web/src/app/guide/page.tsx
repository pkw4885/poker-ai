"use client";

import { useState } from "react";
import Link from "next/link";
import HandSelector from "@/components/guide/HandSelector";
import PositionSelector from "@/components/guide/PositionSelector";

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

function getRecommendation(handKey: string, position: string) {
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
      reasoning: "Premium hand. Raise from any position. 3-bet if facing a raise.",
      tier: "Premium",
    };
  }
  if (isTier2) {
    return {
      action: "RAISE",
      confidence: 0.85,
      reasoning: "Strong hand. Open raise from any position. Call or 3-bet vs a raise.",
      tier: "Strong",
    };
  }
  if (isTier3) {
    if (earlyPos) {
      return {
        action: "RAISE / CALL",
        confidence: 0.7,
        reasoning: "Solid hand. Open raise from early position. Call a raise with position.",
        tier: "Solid",
      };
    }
    return {
      action: "RAISE",
      confidence: 0.8,
      reasoning: "Solid hand in late position. Raise for value.",
      tier: "Solid",
    };
  }
  if (isTier4Pair) {
    if (earlyPos) {
      return {
        action: "CALL / FOLD",
        confidence: 0.55,
        reasoning: "Small pair. Set-mine if the price is right, fold to large raises.",
        tier: "Marginal",
      };
    }
    return {
      action: "RAISE / CALL",
      confidence: 0.65,
      reasoning: "Small pair in position. Can raise to steal or call to set-mine.",
      tier: "Marginal",
    };
  }

  const suited = handKey.endsWith("s");
  if (suited && latePos) {
    return {
      action: "RAISE / CALL",
      confidence: 0.6,
      reasoning: "Suited hand in position. Good playability post-flop.",
      tier: "Speculative",
    };
  }

  if (earlyPos) {
    return {
      action: "FOLD",
      confidence: 0.75,
      reasoning: "Weak hand in early position. Fold and wait for better spots.",
      tier: "Weak",
    };
  }

  if (latePos) {
    return {
      action: "RAISE / FOLD",
      confidence: 0.5,
      reasoning: "Marginal hand. Can steal blinds in late position if unopened.",
      tier: "Marginal",
    };
  }

  return {
    action: "CHECK / FOLD",
    confidence: 0.6,
    reasoning: blinds
      ? "Check from the big blind if possible, fold to raises."
      : "Fold to aggression, play cautiously.",
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

  const handKey = getHandKey(selectedCards);
  const recommendation = getRecommendation(handKey, position);
  const tierStyle = recommendation ? TIER_STYLES[recommendation.tier] || TIER_STYLES.Weak : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <Link
          href="/"
          className="text-xs text-[#666] hover:text-white transition-colors uppercase tracking-wider"
        >
          &larr; Back
        </Link>
        <span className="text-xs font-semibold tracking-widest uppercase text-[#444]">
          Guide
        </span>
        <div className="w-12" />
      </nav>

      <main className="flex flex-col items-center px-4 py-8 md:py-12 gap-8 max-w-xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Preflop Guide
          </h1>
          <p className="text-xs text-[#555] mt-2 tracking-wide">
            Select your hole cards and position
          </p>
        </div>

        {/* Position */}
        <div className="w-full">
          <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-3 block">
            Position
          </label>
          <PositionSelector selected={position} onSelect={setPosition} />
        </div>

        {/* Hand selector */}
        <div className="w-full">
          <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-3 block">
            Your Cards
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
                {recommendation.tier}
              </span>
            </div>

            <div className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
              {recommendation.action}
            </div>

            <p className="text-xs text-[#666] leading-relaxed mb-4">
              {recommendation.reasoning}
            </p>

            {/* Confidence bar */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#555] uppercase tracking-wider">
                Confidence
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
            Select 2 cards to see recommendation
          </div>
        )}
      </main>
    </div>
  );
}
