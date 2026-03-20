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
      action: "Raise",
      confidence: 0.95,
      reasoning: "Premium hand. Raise from any position. 3-bet if facing a raise.",
      color: "text-emerald-400",
    };
  }
  if (isTier2) {
    return {
      action: earlyPos ? "Raise" : "Raise",
      confidence: 0.85,
      reasoning: "Strong hand. Open raise from any position. Call or 3-bet vs a raise.",
      color: "text-emerald-400",
    };
  }
  if (isTier3) {
    if (earlyPos) {
      return {
        action: "Raise / Call",
        confidence: 0.7,
        reasoning: "Solid hand. Open raise from early position. Call a raise with position.",
        color: "text-blue-400",
      };
    }
    return {
      action: "Raise",
      confidence: 0.8,
      reasoning: "Solid hand in late position. Raise for value.",
      color: "text-emerald-400",
    };
  }
  if (isTier4Pair) {
    if (earlyPos) {
      return {
        action: "Call / Fold",
        confidence: 0.55,
        reasoning: "Small pair. Set-mine if the price is right, fold to large raises.",
        color: "text-yellow-400",
      };
    }
    return {
      action: "Raise / Call",
      confidence: 0.65,
      reasoning: "Small pair in position. Can raise to steal or call to set-mine.",
      color: "text-blue-400",
    };
  }

  // Suited connectors
  const suited = handKey.endsWith("s");
  if (suited && latePos) {
    return {
      action: "Raise / Call",
      confidence: 0.6,
      reasoning: "Suited hand in position. Good playability post-flop.",
      color: "text-blue-400",
    };
  }

  if (earlyPos) {
    return {
      action: "Fold",
      confidence: 0.75,
      reasoning: "Weak hand in early position. Fold and wait for better spots.",
      color: "text-red-400",
    };
  }

  if (latePos) {
    return {
      action: "Raise / Fold",
      confidence: 0.5,
      reasoning: "Marginal hand. Can steal blinds in late position if unopened.",
      color: "text-yellow-400",
    };
  }

  return {
    action: "Check / Fold",
    confidence: 0.6,
    reasoning: blinds
      ? "Check from the big blind if possible, fold to raises."
      : "Fold to aggression, play cautiously.",
    color: "text-yellow-400",
  };
}

export default function GuidePage() {
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [position, setPosition] = useState("BTN");

  const handKey = getHandKey(selectedCards);
  const recommendation = getRecommendation(handKey, position);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <header className="p-4">
        <Link
          href="/"
          className="text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </Link>
      </header>

      <main className="flex flex-col items-center px-4 py-6 gap-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold">Poker Guide</h1>
        <p className="text-gray-400 text-center text-sm">
          Select your hole cards and position to get preflop recommendations.
        </p>

        {/* Position */}
        <div className="w-full">
          <h2 className="text-sm font-medium text-gray-400 mb-2">Position</h2>
          <PositionSelector selected={position} onSelect={setPosition} />
        </div>

        {/* Hand selector */}
        <div className="w-full">
          <h2 className="text-sm font-medium text-gray-400 mb-2">
            Your Cards
          </h2>
          <HandSelector selected={selectedCards} onSelect={setSelectedCards} />
        </div>

        {/* Recommendation */}
        {recommendation && selectedCards.length === 2 && (
          <div className="w-full p-6 bg-gray-800/80 border border-gray-700 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">
                {handKey} &middot; {position}
              </span>
              <span className="text-xs text-gray-500">
                Confidence: {Math.round(recommendation.confidence * 100)}%
              </span>
            </div>
            <div className={`text-2xl font-bold mb-2 ${recommendation.color}`}>
              {recommendation.action}
            </div>
            <p className="text-sm text-gray-400">{recommendation.reasoning}</p>
          </div>
        )}

        {selectedCards.length < 2 && (
          <div className="text-sm text-gray-600 text-center">
            Select 2 cards to see recommendation
          </div>
        )}
      </main>
    </div>
  );
}
