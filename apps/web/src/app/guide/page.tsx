"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import HandSelector from "@/components/guide/HandSelector";
import PositionSelector from "@/components/guide/PositionSelector";
import { useI18n, LanguageToggle } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type PreAction = "unopened" | "limped" | "singleRaise" | "threeBet" | "fourBetPlus";
type OpponentStyle = "tight_passive" | "tight_aggressive" | "loose_passive" | "loose_aggressive";
type SkillLevel = "low" | "medium" | "high";
type Street = "preflop" | "flop" | "turn" | "river";

interface GameContext {
  effectiveStack: number;
  numPlayers: number;
  bbSize: number;
}

interface PreActionState {
  type: PreAction;
  raiseSize: number;
  numCallers: number;
}

interface OpponentProfile {
  style: OpponentStyle;
  skillLevel: SkillLevel;
}

interface AdvancedRecommendation {
  primaryAction: string;
  primaryConfidence: number;
  actions: { name: string; percentage: number }[];
  reasoning: string[];
  sizing?: string;
  sprInfo?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_1 = ["AA", "KK", "QQ", "AKs"];
const TIER_2 = ["JJ", "TT", "AQs", "AKo", "AQo"];
const TIER_3 = ["99", "88", "77", "AJs", "ATs", "KQs", "KQo", "AJo"];
const TIER_4_PAIRS = ["66", "55", "44", "33", "22"];
const TIER_5_SUITED = [
  "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s", "65s", "54s",
  "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
];

const RANKS = "23456789TJQKA";

const SUITS_MAP: Record<string, string> = { s: "\u2660", h: "\u2665", d: "\u2666", c: "\u2663" };
const SUIT_COLORS: Record<string, string> = {
  s: "text-white", h: "text-[#ff4444]", d: "text-[#3b82f6]", c: "text-[#00dc82]",
};

const STACK_PRESETS = [10, 25, 50, 100, 200];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHandKey(cards: string[]): string {
  if (cards.length !== 2) return "";
  const [c1, c2] = cards;
  const r1 = c1[0], s1 = c1[1];
  const r2 = c2[0], s2 = c2[1];
  const suited = s1 === s2;
  const i1 = RANKS.indexOf(r1);
  const i2 = RANKS.indexOf(r2);
  const high = i1 >= i2 ? r1 : r2;
  const low = i1 >= i2 ? r2 : r1;
  if (high === low) return `${high}${low}`;
  return `${high}${low}${suited ? "s" : "o"}`;
}

function getHandTier(handKey: string): number {
  if (!handKey) return 6;
  if (TIER_1.includes(handKey)) return 1;
  if (TIER_2.includes(handKey)) return 2;
  if (TIER_3.includes(handKey)) return 3;
  if (TIER_4_PAIRS.includes(handKey)) return 4;
  if (TIER_5_SUITED.includes(handKey)) return 5;
  // Check if it's a pair not in tier 4 (shouldn't happen, but safety)
  if (handKey.length === 2) return 4;
  return 6;
}

function rankIndex(r: string): number {
  return RANKS.indexOf(r);
}

function analyzeBoardTexture(boardCards: string[]): string[] {
  if (boardCards.length < 3) return [];
  const tags: string[] = [];

  const suits = boardCards.map((c) => c[1]);
  const ranks = boardCards.map((c) => rankIndex(c[0])).sort((a, b) => a - b);

  // Suit analysis
  const suitCounts: Record<string, number> = {};
  suits.forEach((s) => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
  const maxSuitCount = Math.max(...Object.values(suitCounts));

  if (maxSuitCount >= 3) tags.push("monotone");
  else if (maxSuitCount === 2 && boardCards.length >= 3) tags.push("twoTone");
  else if (Object.keys(suitCounts).length === boardCards.length) tags.push("rainbow");

  // Rank analysis
  const uniqueRanks = [...new Set(ranks)];
  if (uniqueRanks.length < ranks.length) tags.push("paired");

  // Connectivity
  let maxGap = 0;
  let connectedCount = 0;
  for (let i = 1; i < uniqueRanks.length; i++) {
    const gap = uniqueRanks[i] - uniqueRanks[i - 1];
    if (gap <= 2) connectedCount++;
    maxGap = Math.max(maxGap, gap);
  }
  if (connectedCount >= 2) tags.push("connected");

  // High/low board
  const highCards = ranks.filter((r) => r >= rankIndex("T")).length;
  if (highCards >= 2) tags.push("highCard");
  else if (ranks.every((r) => r <= rankIndex("8"))) tags.push("lowCard");

  // Wet vs dry
  const isWet = tags.includes("connected") || maxSuitCount >= 2;
  tags.push(isWet ? "wet" : "dry");

  return tags;
}

// Check if hand connects with board
function getHandBoardInteraction(handKey: string, boardCards: string[]): string {
  if (!handKey || boardCards.length < 3) return "unknown";
  const handRanks = handKey.length === 2
    ? [handKey[0], handKey[0]]
    : [handKey[0], handKey[1]];
  const boardRanks = boardCards.map((c) => c[0]);

  // Check for pairs/sets
  const pairCount = handRanks.filter((r) => boardRanks.includes(r)).length;
  if (handRanks[0] === handRanks[1] && boardRanks.includes(handRanks[0])) return "set";
  if (pairCount >= 2) return "twoPair";
  if (pairCount === 1) {
    const pairedRank = handRanks.find((r) => boardRanks.includes(r))!;
    if (rankIndex(pairedRank) >= rankIndex("T")) return "topPair";
    return "midPair";
  }

  // Check for draws
  const suited = handKey.endsWith("s");
  if (suited && boardCards.length >= 3) {
    // Simplified flush draw detection
    return "draw";
  }

  // Check for overcards
  const boardMax = Math.max(...boardRanks.map(rankIndex));
  const handMax = Math.max(...handRanks.map(rankIndex));
  if (handMax > boardMax) return "overcards";

  return "air";
}

// ─── Advanced Recommendation Engine ───────────────────────────────────────────

function getAdvancedRecommendation(
  handKey: string,
  position: string,
  gameCtx: GameContext,
  preAction: PreActionState,
  opponent: OpponentProfile,
  street: Street,
  boardCards: string[],
): AdvancedRecommendation | null {

  const { effectiveStack, numPlayers } = gameCtx;
  const earlyPos = ["UTG", "MP"].includes(position);
  const latePos = ["CO", "BTN"].includes(position);
  const blinds = ["SB", "BB"].includes(position);
  const tier = handKey ? getHandTier(handKey) : 0;
  const isPair = handKey.length === 2;
  const isSuited = handKey.endsWith("s");

  // ── PREFLOP LOGIC ──────────────────────────────────────────────────────────

  if (street === "preflop") {
    return getPreflopRecommendation(
      handKey, tier, position, earlyPos, latePos, blinds,
      effectiveStack, numPlayers, preAction, opponent, isPair, isSuited,
    );
  }

  // ── POSTFLOP LOGIC ─────────────────────────────────────────────────────────

  return getPostflopRecommendation(
    handKey, tier, position, earlyPos, latePos, blinds,
    effectiveStack, preAction, opponent, street, boardCards, isPair,
  );
}

function getPreflopRecommendation(
  handKey: string,
  tier: number,
  position: string,
  earlyPos: boolean,
  latePos: boolean,
  blinds: boolean,
  effectiveStack: number,
  numPlayers: number,
  preAction: PreActionState,
  opponent: OpponentProfile,
  isPair: boolean,
  isSuited: boolean,
): AdvancedRecommendation {

  const reasoning: string[] = [];
  let actions: { name: string; percentage: number }[] = [];
  let sizing: string | undefined;
  let sprInfo: string | undefined;

  // ── Push/Fold Mode (<15BB) ──────────────────────────────────────────────
  if (effectiveStack < 15) {
    reasoning.push(`Effective stack is ${effectiveStack}BB — push/fold mode.`);

    if (tier <= 2 || (tier === 3 && effectiveStack <= 10)) {
      // Push range: top 3 tiers with very short stacks
      const pushConf = tier === 1 ? 98 : tier === 2 ? 90 : 78;
      actions = [
        { name: "All-In", percentage: pushConf },
        { name: "Fold", percentage: 100 - pushConf },
      ];
      reasoning.push(`${handKey} is strong enough to push with ${effectiveStack}BB.`);
      sizing = `All-in: ${effectiveStack}BB`;
    } else if (tier <= 4 && latePos && preAction.type === "unopened") {
      actions = [
        { name: "All-In", percentage: 65 },
        { name: "Fold", percentage: 35 },
      ];
      reasoning.push("Late position with an unopened pot — wider push range.");
      sizing = `All-in: ${effectiveStack}BB`;
    } else if (tier <= 3 && blinds && preAction.type !== "fourBetPlus") {
      actions = [
        { name: "All-In", percentage: 55 },
        { name: "Fold", percentage: 45 },
      ];
      reasoning.push("From the blinds, this hand has enough equity to jam.");
      sizing = `All-in: ${effectiveStack}BB`;
    } else {
      actions = [
        { name: "Fold", percentage: 85 },
        { name: "All-In", percentage: 15 },
      ];
      reasoning.push(`${handKey || "This hand"} is too weak to push with ${effectiveStack}BB from ${position}.`);
    }

    return {
      primaryAction: actions[0].name,
      primaryConfidence: actions[0].percentage,
      actions,
      reasoning,
      sizing,
    };
  }

  // ── Short Stack (15-30BB) ───────────────────────────────────────────────
  if (effectiveStack <= 30) {
    reasoning.push(`Short stack (${effectiveStack}BB) — tighter ranges, larger relative sizing.`);
  }

  // ── Unopened Pot ────────────────────────────────────────────────────────
  if (preAction.type === "unopened") {
    const openSize = effectiveStack <= 30 ? 2.5 : (numPlayers >= 7 ? 3 : 2.5);
    sizing = `Open raise: ${openSize}BB`;

    if (tier === 1) {
      const raiseP = 95;
      actions = [{ name: "Raise", percentage: raiseP }, { name: "Call", percentage: 3 }, { name: "Fold", percentage: 2 }];
      reasoning.push(`${handKey} is a premium hand — always open raise from any position.`);
      if (effectiveStack >= 100) reasoning.push("Deep stacks increase implied odds for premium holdings.");
    } else if (tier === 2) {
      actions = [{ name: "Raise", percentage: 90 }, { name: "Call", percentage: 5 }, { name: "Fold", percentage: 5 }];
      reasoning.push(`${handKey} is a strong opening hand from ${position}.`);
    } else if (tier === 3) {
      if (earlyPos) {
        actions = [{ name: "Raise", percentage: 70 }, { name: "Fold", percentage: 20 }, { name: "Call", percentage: 10 }];
        reasoning.push(`Solid hand, but early position requires caution with ${numPlayers}-max.`);
      } else {
        actions = [{ name: "Raise", percentage: 85 }, { name: "Call", percentage: 10 }, { name: "Fold", percentage: 5 }];
        reasoning.push(`${handKey} is a solid open from ${position}.`);
      }
    } else if (tier === 4) {
      if (earlyPos) {
        if (effectiveStack >= 60) {
          actions = [{ name: "Raise", percentage: 50 }, { name: "Fold", percentage: 35 }, { name: "Call", percentage: 15 }];
          reasoning.push("Small pair in early position — deep stacks give set-mining value.");
        } else {
          actions = [{ name: "Fold", percentage: 60 }, { name: "Raise", percentage: 30 }, { name: "Call", percentage: 10 }];
          reasoning.push("Small pair in early position with shallow stacks — limited implied odds.");
        }
      } else {
        actions = [{ name: "Raise", percentage: 70 }, { name: "Call", percentage: 20 }, { name: "Fold", percentage: 10 }];
        reasoning.push("Small pair in position — raise to steal or set-mine.");
      }
    } else if (tier === 5) {
      if (latePos) {
        actions = [{ name: "Raise", percentage: 75 }, { name: "Fold", percentage: 15 }, { name: "Call", percentage: 10 }];
        reasoning.push(`${handKey} plays well from late position — good steal and playability.`);
        if (effectiveStack >= 60) reasoning.push("Deep stacks enhance implied odds for suited connectors.");
      } else if (blinds) {
        actions = [{ name: "Raise", percentage: 40 }, { name: "Call", percentage: 30 }, { name: "Fold", percentage: 30 }];
        reasoning.push("Speculative suited hand from the blinds — mixed strategy.");
      } else {
        actions = [{ name: "Fold", percentage: 55 }, { name: "Raise", percentage: 35 }, { name: "Call", percentage: 10 }];
        reasoning.push(`${handKey} is too speculative to open from early position in ${numPlayers}-max.`);
      }
    } else {
      // Tier 6 - Weak
      if (latePos && numPlayers <= 6) {
        actions = [{ name: "Raise", percentage: 45 }, { name: "Fold", percentage: 50 }, { name: "Call", percentage: 5 }];
        reasoning.push("Marginal hand but position allows blind stealing attempts.");
        sizing = `Open raise: ${openSize}BB (steal)`;
      } else if (position === "BTN") {
        actions = [{ name: "Raise", percentage: 55 }, { name: "Fold", percentage: 40 }, { name: "Call", percentage: 5 }];
        reasoning.push("Button allows wide opens — position advantage postflop.");
      } else if (position === "BB" && preAction.numCallers === 0) {
        actions = [{ name: "Check", percentage: 70 }, { name: "Raise", percentage: 20 }, { name: "Fold", percentage: 10 }];
        reasoning.push("Check from BB with a weak hand — option to see a free flop.");
      } else {
        actions = [{ name: "Fold", percentage: 80 }, { name: "Raise", percentage: 12 }, { name: "Call", percentage: 8 }];
        reasoning.push(`Weak hand in ${position} — fold and wait for a better spot.`);
      }
    }
  }

  // ── Facing Limpers ─────────────────────────────────────────────────────
  else if (preAction.type === "limped") {
    const isoSize = 3 + preAction.numCallers;
    sizing = `Isolation raise: ${isoSize}BB`;

    if (tier <= 2) {
      actions = [{ name: "Raise", percentage: 92 }, { name: "Call", percentage: 6 }, { name: "Fold", percentage: 2 }];
      reasoning.push(`${handKey} — raise to isolate limpers. Premium hand in a limped pot.`);
      sizing = `Isolation raise: ${isoSize}BB`;
    } else if (tier <= 3) {
      actions = [{ name: "Raise", percentage: 75 }, { name: "Call", percentage: 20 }, { name: "Fold", percentage: 5 }];
      reasoning.push("Raise to isolate — solid hand plays better against fewer opponents.");
    } else if (tier === 4 && effectiveStack >= 60) {
      actions = [{ name: "Call", percentage: 55 }, { name: "Raise", percentage: 35 }, { name: "Fold", percentage: 10 }];
      reasoning.push("Small pair — call to set-mine in a multiway pot with deep stacks.");
    } else if (tier === 5 && (latePos || blinds)) {
      if (effectiveStack >= 50) {
        actions = [{ name: "Call", percentage: 45 }, { name: "Raise", percentage: 40 }, { name: "Fold", percentage: 15 }];
        reasoning.push("Suited connector in position — good implied odds in limped pot.");
      } else {
        actions = [{ name: "Fold", percentage: 45 }, { name: "Call", percentage: 35 }, { name: "Raise", percentage: 20 }];
        reasoning.push("Speculative hand — stacks may be too shallow for implied odds.");
      }
    } else {
      actions = [{ name: "Fold", percentage: 65 }, { name: "Call", percentage: 25 }, { name: "Raise", percentage: 10 }];
      reasoning.push("Weak hand vs limpers — avoid building a pot out of position.");
    }
  }

  // ── Facing Single Raise ────────────────────────────────────────────────
  else if (preAction.type === "singleRaise") {
    const raiseAmt = preAction.raiseSize;
    const threeBetSize = Math.round(raiseAmt * 3);
    sizing = `3-bet: ${threeBetSize}BB`;
    sprInfo = `If called, SPR ≈ ${Math.max(0.5, Math.round((effectiveStack - threeBetSize) / (threeBetSize * 2) * 10) / 10)}`;

    // Adjust based on opponent
    const vsTag = opponent.style === "tight_aggressive";
    const vsLag = opponent.style === "loose_aggressive";
    const vsStation = opponent.style === "loose_passive";
    const vsRock = opponent.style === "tight_passive";

    if (tier === 1) {
      const threeBetP = vsRock ? 80 : 90;
      actions = [{ name: "3-Bet", percentage: threeBetP }, { name: "Call", percentage: 100 - threeBetP - 1 }, { name: "Fold", percentage: 1 }];
      reasoning.push(`${handKey} is premium — 3-bet for value against a single raise.`);
      if (vsRock) reasoning.push("Against a tight-passive player, consider a smaller 3-bet to keep them in.");
      if (vsLag) reasoning.push("Against a LAG, 3-bet large for value — they have a wide opening range.");
    } else if (tier === 2) {
      if (vsTag) {
        actions = [{ name: "3-Bet", percentage: 55 }, { name: "Call", percentage: 35 }, { name: "Fold", percentage: 10 }];
        reasoning.push("Strong hand vs TAG — mix between 3-bet and call to balance.");
      } else if (vsLag) {
        actions = [{ name: "3-Bet", percentage: 75 }, { name: "Call", percentage: 20 }, { name: "Fold", percentage: 5 }];
        reasoning.push("Against a LAG, 3-bet wider for value — they open too many hands.");
      } else {
        actions = [{ name: "3-Bet", percentage: 65 }, { name: "Call", percentage: 30 }, { name: "Fold", percentage: 5 }];
        reasoning.push(`${handKey} is strong — 3-bet as the default, flat call in position.`);
      }
    } else if (tier === 3) {
      if (latePos) {
        actions = [{ name: "Call", percentage: 50 }, { name: "3-Bet", percentage: 35 }, { name: "Fold", percentage: 15 }];
        reasoning.push("Solid hand in position — calling is profitable, 3-bet as a bluff/value mix.");
      } else {
        if (vsStation) {
          actions = [{ name: "Call", percentage: 55 }, { name: "3-Bet", percentage: 20 }, { name: "Fold", percentage: 25 }];
          reasoning.push("Against a calling station, flat call to keep the pot manageable.");
        } else {
          actions = [{ name: "Call", percentage: 40 }, { name: "Fold", percentage: 35 }, { name: "3-Bet", percentage: 25 }];
          reasoning.push("Solid hand out of position — tighter continuing range needed.");
        }
      }
    } else if (tier === 4 && effectiveStack >= 50) {
      actions = [{ name: "Call", percentage: 55 }, { name: "Fold", percentage: 35 }, { name: "3-Bet", percentage: 10 }];
      reasoning.push(`Small pair — set-mine with ${effectiveStack}BB effective. Need ~15:1 implied odds.`);
      const impliedOdds = effectiveStack / raiseAmt;
      if (impliedOdds < 10) {
        reasoning.push(`Implied odds (${Math.round(impliedOdds)}:1) may be insufficient — lean toward fold.`);
        actions = [{ name: "Fold", percentage: 55 }, { name: "Call", percentage: 40 }, { name: "3-Bet", percentage: 5 }];
      }
    } else if (tier === 5 && latePos && effectiveStack >= 60) {
      actions = [{ name: "Call", percentage: 50 }, { name: "3-Bet", percentage: 25 }, { name: "Fold", percentage: 25 }];
      reasoning.push("Suited connector in position with deep stacks — good implied odds to call.");
    } else {
      if (vsRock) {
        actions = [{ name: "Fold", percentage: 90 }, { name: "Call", percentage: 8 }, { name: "3-Bet", percentage: 2 }];
        reasoning.push("Against a tight-passive player's raise, weak hands should fold.");
      } else {
        actions = [{ name: "Fold", percentage: 75 }, { name: "Call", percentage: 18 }, { name: "3-Bet", percentage: 7 }];
        reasoning.push(`${handKey || "This hand"} is too weak to continue vs a raise from ${position}.`);
      }
    }
  }

  // ── Facing 3-Bet ───────────────────────────────────────────────────────
  else if (preAction.type === "threeBet") {
    const raiseAmt = preAction.raiseSize;
    const fourBetSize = Math.round(raiseAmt * 2.5);
    sizing = `4-bet: ${fourBetSize}BB`;

    if (tier === 1) {
      if (effectiveStack <= 40) {
        actions = [{ name: "All-In", percentage: 85 }, { name: "Call", percentage: 10 }, { name: "Fold", percentage: 5 }];
        reasoning.push("Premium hand facing 3-bet with short/medium stacks — 5-bet all-in.");
        sizing = `All-in: ${effectiveStack}BB`;
      } else {
        actions = [{ name: "4-Bet", percentage: 70 }, { name: "Call", percentage: 25 }, { name: "Fold", percentage: 5 }];
        reasoning.push(`${handKey} — 4-bet for value. Strong enough to build a big pot.`);
      }
    } else if (tier === 2) {
      const vsTag = opponent.style === "tight_aggressive";
      if (vsTag) {
        actions = [{ name: "Call", percentage: 50 }, { name: "4-Bet", percentage: 25 }, { name: "Fold", percentage: 25 }];
        reasoning.push("Strong hand vs TAG's 3-bet — calling is often best to keep range balanced.");
      } else {
        actions = [{ name: "4-Bet", percentage: 45 }, { name: "Call", percentage: 40 }, { name: "Fold", percentage: 15 }];
        reasoning.push("Strong hand facing 3-bet — mix of 4-bet and flat depending on reads.");
      }
    } else if (tier === 3) {
      actions = [{ name: "Fold", percentage: 55 }, { name: "Call", percentage: 35 }, { name: "4-Bet", percentage: 10 }];
      reasoning.push("Solid but not premium — calling a 3-bet is marginal, position matters greatly.");
      if (!latePos) {
        actions = [{ name: "Fold", percentage: 70 }, { name: "Call", percentage: 25 }, { name: "4-Bet", percentage: 5 }];
        reasoning.push("Out of position facing a 3-bet — lean toward folding with this tier.");
      }
    } else {
      actions = [{ name: "Fold", percentage: 85 }, { name: "Call", percentage: 10 }, { name: "4-Bet", percentage: 5 }];
      reasoning.push("Weak/marginal hand facing a 3-bet — fold in most scenarios.");
    }
  }

  // ── Facing 4-Bet+ ─────────────────────────────────────────────────────
  else if (preAction.type === "fourBetPlus") {
    if (tier === 1 && (handKey === "AA" || handKey === "KK")) {
      actions = [{ name: "All-In", percentage: 95 }, { name: "Call", percentage: 4 }, { name: "Fold", percentage: 1 }];
      reasoning.push(`${handKey} — always get it in facing a 4-bet.`);
      sizing = `All-in: ${effectiveStack}BB`;
    } else if (tier === 1) {
      actions = [{ name: "All-In", percentage: 70 }, { name: "Call", percentage: 20 }, { name: "Fold", percentage: 10 }];
      reasoning.push("Premium hand vs 4-bet — usually committed, but consider villain's range.");
    } else if (tier === 2 && effectiveStack <= 50) {
      actions = [{ name: "All-In", percentage: 45 }, { name: "Fold", percentage: 40 }, { name: "Call", percentage: 15 }];
      reasoning.push("Strong hand facing 4-bet with short stacks — pot-committed decision.");
    } else {
      actions = [{ name: "Fold", percentage: 90 }, { name: "All-In", percentage: 7 }, { name: "Call", percentage: 3 }];
      reasoning.push("Facing a 4-bet+ — only continue with the very top of your range.");
    }
  }

  // ── Opponent Adjustments ───────────────────────────────────────────────
  if (opponent.style === "tight_passive" && preAction.type !== "unopened") {
    reasoning.push("vs Rock: Respect their aggression — they rarely bluff. Tighten your continuing range.");
  } else if (opponent.style === "loose_passive") {
    reasoning.push("vs Calling Station: Value bet wider, avoid bluffing. They call too much.");
  } else if (opponent.style === "loose_aggressive" && preAction.type !== "unopened") {
    reasoning.push("vs LAG: Widen your value range. Consider trapping with premium hands.");
  } else if (opponent.style === "tight_aggressive") {
    reasoning.push("vs TAG: Solid opponent — respect their range but look for steal spots.");
  }

  // ── Stack Depth Note ───────────────────────────────────────────────────
  if (effectiveStack >= 100 && tier >= 4) {
    reasoning.push("Very deep stacks favor speculative hands — implied odds are maximized.");
  } else if (effectiveStack <= 30 && tier >= 4) {
    reasoning.push("Short stacks reduce implied odds — speculative hands lose value.");
  }

  return {
    primaryAction: actions[0]?.name || "Fold",
    primaryConfidence: actions[0]?.percentage || 50,
    actions,
    reasoning,
    sizing,
    sprInfo,
  };
}

function getPostflopRecommendation(
  handKey: string,
  tier: number,
  position: string,
  earlyPos: boolean,
  latePos: boolean,
  blinds: boolean,
  effectiveStack: number,
  preAction: PreActionState,
  opponent: OpponentProfile,
  street: Street,
  boardCards: string[],
  isPair: boolean,
): AdvancedRecommendation {
  const reasoning: string[] = [];
  let actions: { name: string; percentage: number }[] = [];
  let sizing: string | undefined;
  let sprInfo: string | undefined;

  const textureTags = analyzeBoardTexture(boardCards);
  const interaction = handKey ? getHandBoardInteraction(handKey, boardCards) : "unknown";

  // Estimate pot size based on preaction
  let potBB = 1.5; // blinds
  if (preAction.type === "singleRaise") {
    potBB = preAction.raiseSize * 2 + 1 + preAction.numCallers * preAction.raiseSize;
  } else if (preAction.type === "threeBet") {
    potBB = preAction.raiseSize * 2 + preAction.numCallers * preAction.raiseSize;
  } else if (preAction.type === "limped") {
    potBB = 1 + 0.5 + (preAction.numCallers + 1) * 1;
  }

  const remainingStack = effectiveStack - (potBB / 2);
  const spr = remainingStack / potBB;
  sprInfo = `SPR: ${Math.round(spr * 10) / 10} | Pot: ~${Math.round(potBB)}BB`;

  reasoning.push(`${street.charAt(0).toUpperCase() + street.slice(1)} — SPR ≈ ${Math.round(spr * 10) / 10}.`);

  if (interaction !== "unknown") {
    const interactionLabels: Record<string, string> = {
      set: "You have a set — very strong hand.",
      twoPair: "Two pair — strong but vulnerable on wet boards.",
      topPair: "Top pair — solid made hand, protect against draws.",
      midPair: "Middle/bottom pair — marginal made hand.",
      draw: "You have a draw — consider pot odds and implied odds.",
      overcards: "Overcards — no made hand yet, but drawing live.",
      air: "No made hand and no strong draws.",
    };
    reasoning.push(interactionLabels[interaction] || "");
  }

  const isWet = textureTags.includes("wet");
  const isDry = textureTags.includes("dry");

  // ── Strong Made Hands (Set, Two Pair) ──────────────────────────────────
  if (interaction === "set" || interaction === "twoPair") {
    if (spr <= 2) {
      actions = [{ name: "All-In", percentage: 75 }, { name: "Bet", percentage: 20 }, { name: "Check", percentage: 5 }];
      reasoning.push("Low SPR with a strong hand — look to get stacks in.");
      sizing = `All-in: ${Math.round(remainingStack)}BB`;
    } else if (isWet) {
      const betSize = Math.round(potBB * 0.75);
      actions = [{ name: "Bet", percentage: 70 }, { name: "Check-Raise", percentage: 20 }, { name: "Check", percentage: 10 }];
      reasoning.push("Wet board — bet to protect and build the pot.");
      sizing = `Bet: ${betSize}BB (75% pot)`;
    } else {
      const betSize = Math.round(potBB * 0.5);
      actions = [{ name: "Bet", percentage: 55 }, { name: "Check", percentage: 30 }, { name: "Check-Raise", percentage: 15 }];
      reasoning.push("Dry board — can slow-play or bet smaller for value.");
      sizing = `Bet: ${betSize}BB (50% pot)`;
    }

    if (opponent.style === "loose_passive") {
      reasoning.push("vs Calling Station — bet large for value, they will call too often.");
    }
  }

  // ── Top Pair ───────────────────────────────────────────────────────────
  else if (interaction === "topPair") {
    const betSize = Math.round(potBB * 0.6);
    if (spr <= 3) {
      actions = [{ name: "Bet", percentage: 65 }, { name: "All-In", percentage: 20 }, { name: "Check", percentage: 15 }];
      reasoning.push("Low SPR with top pair — commit to the pot.");
      sizing = `Bet: ${betSize}BB or All-in: ${Math.round(remainingStack)}BB`;
    } else if (isWet) {
      actions = [{ name: "Bet", percentage: 70 }, { name: "Check", percentage: 20 }, { name: "Check-Raise", percentage: 10 }];
      reasoning.push("Top pair on a wet board — bet to deny equity from draws.");
      sizing = `Bet: ${betSize}BB (60% pot)`;
    } else {
      actions = [{ name: "Bet", percentage: 55 }, { name: "Check", percentage: 35 }, { name: "Raise", percentage: 10 }];
      reasoning.push("Top pair on a dry board — can thin value bet or check for pot control.");
      sizing = `Bet: ${Math.round(potBB * 0.4)}BB (40% pot)`;
    }

    if (opponent.style === "tight_aggressive" && street === "river") {
      reasoning.push("Be cautious vs TAG aggression on the river — they rarely bluff.");
    }
  }

  // ── Mid/Bottom Pair ────────────────────────────────────────────────────
  else if (interaction === "midPair") {
    if (latePos && !isWet) {
      actions = [{ name: "Bet", percentage: 40 }, { name: "Check", percentage: 45 }, { name: "Fold", percentage: 15 }];
      reasoning.push("Middle pair — bet small for thin value or check for pot control.");
      sizing = `Bet: ${Math.round(potBB * 0.33)}BB (33% pot)`;
    } else {
      actions = [{ name: "Check", percentage: 55 }, { name: "Fold", percentage: 25 }, { name: "Bet", percentage: 20 }];
      reasoning.push("Marginal made hand — check and re-evaluate against action.");
    }
  }

  // ── Draws ──────────────────────────────────────────────────────────────
  else if (interaction === "draw") {
    const potOdds = 1 / (1 + potBB / (potBB * 0.75));
    if (street === "flop") {
      actions = [{ name: "Call", percentage: 40 }, { name: "Raise", percentage: 30 }, { name: "Fold", percentage: 20 }, { name: "Bet", percentage: 10 }];
      reasoning.push("Drawing hand on the flop — two cards to come gives better equity.");
      reasoning.push("Consider semi-bluff raising to build fold equity.");
      sizing = `Semi-bluff raise: ${Math.round(potBB * 0.75)}BB`;
    } else if (street === "turn") {
      actions = [{ name: "Call", percentage: 35 }, { name: "Fold", percentage: 35 }, { name: "Bet", percentage: 20 }, { name: "Raise", percentage: 10 }];
      reasoning.push("Draw on the turn — one card to come, need better pot odds.");
    } else {
      actions = [{ name: "Fold", percentage: 65 }, { name: "Bet", percentage: 25 }, { name: "Call", percentage: 10 }];
      reasoning.push("Missed draw on the river — bluff or give up.");
      if (opponent.style === "loose_passive") {
        reasoning.push("Don't bluff a calling station — they won't fold.");
        actions = [{ name: "Fold", percentage: 85 }, { name: "Check", percentage: 10 }, { name: "Bet", percentage: 5 }];
      }
    }
  }

  // ── Overcards ──────────────────────────────────────────────────────────
  else if (interaction === "overcards") {
    if (latePos && street === "flop") {
      const cBetSize = Math.round(potBB * 0.5);
      actions = [{ name: "Bet", percentage: 45 }, { name: "Check", percentage: 35 }, { name: "Fold", percentage: 20 }];
      reasoning.push("Overcards with position — continuation bet on dry boards.");
      sizing = `C-bet: ${cBetSize}BB (50% pot)`;
      if (isWet) {
        actions = [{ name: "Check", percentage: 50 }, { name: "Bet", percentage: 30 }, { name: "Fold", percentage: 20 }];
        reasoning.push("Wet board — more cautious with just overcards.");
      }
    } else {
      actions = [{ name: "Check", percentage: 50 }, { name: "Fold", percentage: 35 }, { name: "Bet", percentage: 15 }];
      reasoning.push("Overcards out of position — check and re-evaluate.");
    }
  }

  // ── Air / Unknown ──────────────────────────────────────────────────────
  else {
    if (latePos && street === "flop") {
      const cBetSize = Math.round(potBB * 0.33);
      actions = [{ name: "Bet", percentage: 35 }, { name: "Check", percentage: 40 }, { name: "Fold", percentage: 25 }];
      reasoning.push("No made hand — consider a small c-bet as a bluff with position.");
      sizing = `C-bet bluff: ${cBetSize}BB (33% pot)`;
      if (isDry) reasoning.push("Dry board favors the preflop aggressor — bluff more often.");
    } else {
      actions = [{ name: "Check", percentage: 45 }, { name: "Fold", percentage: 45 }, { name: "Bet", percentage: 10 }];
      reasoning.push("No hand, no draw — check and prepare to fold to aggression.");
    }
  }

  return {
    primaryAction: actions[0]?.name || "Check",
    primaryConfidence: actions[0]?.percentage || 50,
    actions,
    reasoning,
    sizing,
    sprInfo,
  };
}

// Range advice when no cards selected
function getRangeAdvice(
  position: string,
  preAction: PreActionState,
  effectiveStack: number,
  opponent: OpponentProfile,
): AdvancedRecommendation {
  const reasoning: string[] = [];
  let actions: { name: string; percentage: number }[] = [];
  let sizing: string | undefined;

  const earlyPos = ["UTG", "MP"].includes(position);
  const latePos = ["CO", "BTN"].includes(position);

  if (effectiveStack < 15) {
    reasoning.push(`Push/fold mode at ${effectiveStack}BB.`);
    if (earlyPos) {
      reasoning.push("UTG/MP push range: AA-77, AKs-ATs, AKo-AQo (~10% of hands).");
    } else if (latePos) {
      reasoning.push("CO/BTN push range: AA-22, any Ax suited, KQs-K9s, broadways (~25-35% of hands).");
    } else {
      reasoning.push("Blinds push range: Wider vs steal attempts — any pair, Ax, Kx suited, connected (~20-30%).");
    }
    actions = [{ name: "Push/Fold", percentage: 100 }];
    sizing = `All-in: ${effectiveStack}BB`;
  } else if (preAction.type === "unopened") {
    if (earlyPos) {
      reasoning.push("UTG/MP open range (6-max): ~15% — AA-22, AKs-ATs, AKo-AJo, KQs.");
      reasoning.push("Avoid hands like KJo, QJo from early position.");
    } else if (position === "CO") {
      reasoning.push("CO open range: ~25% — pairs, suited aces, suited broadways, suited connectors 54s+.");
    } else if (position === "BTN") {
      reasoning.push("BTN open range: ~40%+ — very wide. Almost any suited hand, offsuit broadways, suited connectors.");
    } else if (position === "SB") {
      reasoning.push("SB open range: ~35% vs BB — or 3-bet/fold strategy. Avoid limping.");
    } else {
      reasoning.push("BB defense: Defend wide vs button opens (50%+). Tighter vs UTG (20-25%).");
    }
    actions = [{ name: "Raise", percentage: 85 }, { name: "Fold", percentage: 15 }];
    sizing = "Open: 2.5BB (standard) or 3BB (with limpers behind)";
  } else if (preAction.type === "singleRaise") {
    if (latePos) {
      reasoning.push("Facing raise in position: 3-bet ~10-15% (value + bluffs), flat ~15-20%, fold the rest.");
      reasoning.push("3-bet value: QQ+, AKs. Bluff 3-bet: A5s-A2s, suited connectors.");
    } else {
      reasoning.push("Facing raise OOP: Tighter range. 3-bet ~8-10%, flat ~10%, fold ~80%.");
    }
    if (opponent.style === "loose_aggressive") {
      reasoning.push("vs LAG: Widen your 3-bet value range and trap with premiums.");
    }
    actions = [{ name: "Fold", percentage: 60 }, { name: "Call", percentage: 25 }, { name: "3-Bet", percentage: 15 }];
    sizing = `3-bet: ${Math.round(preAction.raiseSize * 3)}BB`;
  } else {
    reasoning.push("Facing 3-bet+: Only continue with the top of your range (QQ+, AKs).");
    reasoning.push("4-bet bluff occasionally with blockers (AKo, A5s).");
    actions = [{ name: "Fold", percentage: 70 }, { name: "Call", percentage: 15 }, { name: "4-Bet", percentage: 15 }];
  }

  // Opponent adjustment
  if (opponent.style === "tight_passive") {
    reasoning.push("vs Rock: Steal aggressively — they fold too much. Respect their raises.");
  } else if (opponent.style === "loose_passive") {
    reasoning.push("vs Calling Station: Value bet wider, avoid bluffing. Iso-raise limps.");
  }

  return {
    primaryAction: actions[0]?.name || "Fold",
    primaryConfidence: actions[0]?.percentage || 50,
    actions,
    reasoning,
    sizing,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-3 block">
      {children}
    </label>
  );
}

function BoardCardSelector({
  selected,
  onSelect,
  maxCards,
  excludeCards,
}: {
  selected: string[];
  onSelect: (cards: string[]) => void;
  maxCards: number;
  excludeCards: string[];
}) {
  const { t } = useI18n();
  const BOARD_RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const BOARD_SUITS = [
    { key: "s", symbol: "\u2660", color: "text-white" },
    { key: "h", symbol: "\u2665", color: "text-[#ff4444]" },
    { key: "d", symbol: "\u2666", color: "text-[#3b82f6]" },
    { key: "c", symbol: "\u2663", color: "text-[#00dc82]" },
  ];

  const toggleCard = (card: string) => {
    if (selected.includes(card)) {
      onSelect(selected.filter((c) => c !== card));
    } else if (selected.length < maxCards) {
      onSelect([...selected, card]);
    }
  };

  return (
    <div className="flex flex-col gap-[2px]">
      {BOARD_SUITS.map((suit) => (
        <div key={suit.key} className="flex gap-[2px]">
          {BOARD_RANKS.map((rank) => {
            const card = `${rank}${suit.key}`;
            const isSelected = selected.includes(card);
            const isExcluded = excludeCards.includes(card);
            return (
              <button
                key={card}
                onClick={() => !isExcluded && toggleCard(card)}
                disabled={isExcluded}
                className={`w-7 h-9 md:w-9 md:h-11 text-[10px] md:text-xs font-medium transition-all flex flex-col items-center justify-center border ${
                  isExcluded
                    ? "bg-[#0a0a0a] border-[#181818] opacity-30 cursor-not-allowed"
                    : isSelected
                    ? "bg-[#3b82f6] border-[#3b82f6] text-white"
                    : "bg-[#111] border-[#222] hover:border-[#444]"
                }`}
              >
                <span className={isSelected ? "text-white font-bold" : isExcluded ? "text-[#333]" : "text-[#999]"}>
                  {rank}
                </span>
                <span
                  className={
                    isSelected
                      ? "text-white text-[8px] md:text-[10px]"
                      : isExcluded
                      ? "text-[#333] text-[8px] md:text-[10px]"
                      : `${suit.color} text-[8px] md:text-[10px]`
                  }
                >
                  {suit.symbol}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="text-[10px] text-[#444] mt-2 tracking-wider">
        {selected.length}/{maxCards} {t("common.selected")}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const { t } = useI18n();

  // Hand & Position
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [position, setPosition] = useState("BTN");

  // Game Context
  const [effectiveStack, setEffectiveStack] = useState(100);
  const [numPlayers, setNumPlayers] = useState(6);
  const [bbSize, setBbSize] = useState(10);

  // Pre-Action
  const [preActionType, setPreActionType] = useState<PreAction>("unopened");
  const [raiseSize, setRaiseSize] = useState(6);
  const [numCallers, setNumCallers] = useState(0);

  // Opponent Profile
  const [opponentStyle, setOpponentStyle] = useState<OpponentStyle>("tight_aggressive");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("medium");

  // Street & Board
  const [street, setStreet] = useState<Street>("preflop");
  const [boardCards, setBoardCards] = useState<string[]>([]);

  const boardCardCount = street === "flop" ? 3 : street === "turn" ? 4 : street === "river" ? 5 : 0;

  // When street changes, trim board cards
  const handleStreetChange = (s: Street) => {
    setStreet(s);
    const max = s === "flop" ? 3 : s === "turn" ? 4 : s === "river" ? 5 : 0;
    if (s === "preflop") setBoardCards([]);
    else if (boardCards.length > max) setBoardCards(boardCards.slice(0, max));
  };

  const handKey = getHandKey(selectedCards);
  const textureTags = useMemo(() => analyzeBoardTexture(boardCards), [boardCards]);

  const recommendation = useMemo(() => {
    const gameCtx: GameContext = { effectiveStack, numPlayers, bbSize };
    const preAction: PreActionState = { type: preActionType, raiseSize, numCallers };
    const opp: OpponentProfile = { style: opponentStyle, skillLevel };

    if (selectedCards.length === 0) {
      return getRangeAdvice(position, preAction, effectiveStack, opp);
    }
    if (selectedCards.length === 2) {
      return getAdvancedRecommendation(handKey, position, gameCtx, preAction, opp, street, boardCards);
    }
    return null;
  }, [selectedCards, handKey, position, effectiveStack, numPlayers, bbSize, preActionType, raiseSize, numCallers, opponentStyle, skillLevel, street, boardCards]);

  const showRaiseSize = preActionType === "singleRaise" || preActionType === "threeBet";

  // Summary line
  const summaryParts: string[] = [];
  summaryParts.push(position);
  if (handKey) summaryParts.push(handKey);
  else summaryParts.push(t("guide.rangeAdvice"));
  summaryParts.push(`${effectiveStack}BB`);
  summaryParts.push(`${numPlayers}-max`);
  const preActionLabels: Record<PreAction, string> = {
    unopened: "Unopened",
    limped: "Limped",
    singleRaise: "Single Raise",
    threeBet: "3-Bet",
    fourBetPlus: "4-Bet+",
  };
  summaryParts.push(preActionLabels[preActionType]);
  if (street !== "preflop") summaryParts.push(street.charAt(0).toUpperCase() + street.slice(1));
  const summaryLine = summaryParts.join(" \u00B7 ");

  // Stack depth label
  const stackLabel = effectiveStack < 15 ? t("guide.pushFoldZone") : effectiveStack <= 30 ? t("guide.shortStack") : effectiveStack <= 60 ? t("guide.midStack") : effectiveStack <= 100 ? t("guide.deepStack") : t("guide.veryDeep");

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
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {t("guide.title")}
          </h1>
          <p className="text-xs text-[#555] mt-2 tracking-wide">
            {t("guide.subtitle")}
          </p>
        </div>

        {/* ── Section 1: Position ── */}
        <div className="w-full">
          <SectionLabel>{t("guide.position")}</SectionLabel>
          <PositionSelector selected={position} onSelect={setPosition} />
        </div>

        {/* ── Section 2: Hand ── */}
        <div className="w-full border-t border-[#1a1a1a] pt-6">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>{t("guide.yourCards")}</SectionLabel>
            {selectedCards.length > 0 && (
              <button
                onClick={() => setSelectedCards([])}
                className="text-[10px] tracking-wider text-[#555] hover:text-white transition-colors uppercase"
              >
                {t("guide.clearCards")}
              </button>
            )}
          </div>
          <HandSelector selected={selectedCards} onSelect={setSelectedCards} />
          {selectedCards.length === 0 && (
            <p className="text-[10px] text-[#444] mt-2 tracking-wide">{t("guide.selectPrompt")}</p>
          )}
        </div>

        {/* ── Section 3: Game Context ── */}
        <div className="w-full border-t border-[#1a1a1a] pt-6">
          <SectionLabel>{t("guide.gameContext")}</SectionLabel>

          {/* Effective Stack */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#666] uppercase tracking-wider">{t("guide.effectiveStack")}</span>
              <span className="text-xs text-white font-mono">{effectiveStack}BB <span className="text-[10px] text-[#555]">({stackLabel})</span></span>
            </div>
            <input
              type="range"
              min={5}
              max={200}
              value={effectiveStack}
              onChange={(e) => setEffectiveStack(Number(e.target.value))}
              className="w-full h-[2px] bg-[#222] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-0"
            />
            <div className="flex gap-2 mt-2">
              {STACK_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setEffectiveStack(v)}
                  className={`px-3 py-1 text-[10px] font-mono tracking-wider border transition-all ${
                    effectiveStack === v
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Number of Players */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#666] uppercase tracking-wider">{t("guide.numPlayers")}</span>
              <span className="text-xs text-white font-mono">{numPlayers}</span>
            </div>
            <input
              type="range"
              min={2}
              max={9}
              value={numPlayers}
              onChange={(e) => setNumPlayers(Number(e.target.value))}
              className="w-full h-[2px] bg-[#222] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-0"
            />
          </div>

          {/* Big Blind Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#666] uppercase tracking-wider">{t("guide.bbSize")}</span>
            </div>
            <input
              type="number"
              min={1}
              value={bbSize}
              onChange={(e) => setBbSize(Math.max(1, Number(e.target.value)))}
              className="w-20 bg-[#111] border border-[#222] text-white text-xs font-mono px-3 py-2 focus:outline-none focus:border-[#444]"
            />
          </div>
        </div>

        {/* ── Section 4: Pre-Action ── */}
        <div className="w-full border-t border-[#1a1a1a] pt-6">
          <SectionLabel>{t("guide.preAction")}</SectionLabel>
          <div className="flex flex-wrap gap-2 mb-4">
            {(["unopened", "limped", "singleRaise", "threeBet", "fourBetPlus"] as PreAction[]).map((pa) => (
              <button
                key={pa}
                onClick={() => setPreActionType(pa)}
                className={`px-3 py-2 text-[10px] tracking-wider uppercase border transition-all ${
                  preActionType === pa
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                }`}
              >
                {t(`guide.${pa}`)}
              </button>
            ))}
          </div>

          {/* Raise Size slider */}
          {showRaiseSize && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#666] uppercase tracking-wider">{t("guide.raiseSize")}</span>
                <span className="text-xs text-white font-mono">{raiseSize}BB</span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                value={raiseSize}
                onChange={(e) => setRaiseSize(Number(e.target.value))}
                className="w-full h-[2px] bg-[#222] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-0"
              />
            </div>
          )}

          {/* Number of Callers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#666] uppercase tracking-wider">{t("guide.numCallers")}</span>
              <span className="text-xs text-white font-mono">{numCallers}</span>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumCallers(n)}
                  className={`w-8 h-8 text-[10px] font-mono border transition-all ${
                    numCallers === n
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 5: Opponent Profile ── */}
        <div className="w-full border-t border-[#1a1a1a] pt-6">
          <SectionLabel>{t("guide.opponentProfile")}</SectionLabel>

          {/* Style Matrix 2x2 */}
          <div className="mb-4">
            <span className="text-[10px] text-[#666] uppercase tracking-wider block mb-2">{t("guide.style")}</span>
            <div className="grid grid-cols-2 gap-[2px]">
              {(["tight_passive", "tight_aggressive", "loose_passive", "loose_aggressive"] as OpponentStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setOpponentStyle(s)}
                  className={`px-3 py-3 text-[10px] md:text-[11px] tracking-wider border transition-all text-left ${
                    opponentStyle === s
                      ? "bg-white text-black border-white"
                      : "bg-[#111] text-[#666] border-[#222] hover:border-[#444]"
                  }`}
                >
                  {t(`guide.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Skill Level */}
          <div>
            <span className="text-[10px] text-[#666] uppercase tracking-wider block mb-2">{t("guide.skillLevel")}</span>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as SkillLevel[]).map((sl) => (
                <button
                  key={sl}
                  onClick={() => setSkillLevel(sl)}
                  className={`px-4 py-2 text-[10px] tracking-wider uppercase border transition-all ${
                    skillLevel === sl
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                  }`}
                >
                  {t(`guide.skill${sl.charAt(0).toUpperCase() + sl.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 6: Street & Board ── */}
        <div className="w-full border-t border-[#1a1a1a] pt-6">
          <SectionLabel>{t("guide.streetBoard")}</SectionLabel>

          {/* Street tabs */}
          <div className="flex gap-0 mb-4">
            {(["preflop", "flop", "turn", "river"] as Street[]).map((s) => (
              <button
                key={s}
                onClick={() => handleStreetChange(s)}
                className={`flex-1 py-2 text-[10px] tracking-wider uppercase border-b-2 transition-all ${
                  street === s
                    ? "border-white text-white"
                    : "border-[#222] text-[#555] hover:text-[#999]"
                }`}
              >
                {t(`guide.${s}`)}
              </button>
            ))}
          </div>

          {/* Board cards */}
          {street !== "preflop" && (
            <div className="mb-4">
              <span className="text-[10px] text-[#666] uppercase tracking-wider block mb-2">{t("guide.boardCards")}</span>
              <BoardCardSelector
                selected={boardCards}
                onSelect={setBoardCards}
                maxCards={boardCardCount}
                excludeCards={selectedCards}
              />
            </div>
          )}

          {/* Board texture tags */}
          {street !== "preflop" && textureTags.length > 0 && (
            <div>
              <span className="text-[10px] text-[#666] uppercase tracking-wider block mb-2">{t("guide.boardTexture")}</span>
              <div className="flex flex-wrap gap-2">
                {textureTags.map((tag) => {
                  const tagColors: Record<string, string> = {
                    dry: "border-[#fbbf24] text-[#fbbf24]",
                    wet: "border-[#3b82f6] text-[#3b82f6]",
                    monotone: "border-[#ff4444] text-[#ff4444]",
                    paired: "border-[#f97316] text-[#f97316]",
                    connected: "border-[#00dc82] text-[#00dc82]",
                    highCard: "border-white text-white",
                    lowCard: "border-[#555] text-[#555]",
                    rainbow: "border-[#a78bfa] text-[#a78bfa]",
                    twoTone: "border-[#818cf8] text-[#818cf8]",
                  };
                  return (
                    <span
                      key={tag}
                      className={`px-2 py-1 text-[10px] tracking-wider uppercase border ${tagColors[tag] || "border-[#333] text-[#666]"}`}
                    >
                      {t(`guide.texture.${tag}`)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Recommendation Output ── */}
        {recommendation && (
          <div className="w-full border border-[#222] bg-[#111]">
            {/* Situation Summary */}
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#555] block mb-1">
                {t("guide.situationSummary")}
              </span>
              <span className="text-xs text-white font-mono tracking-wide">
                {summaryLine}
              </span>
            </div>

            {/* Recommended Action */}
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
                  {t("guide.recommendedAction")}
                </span>
                <span className="text-[10px] text-[#666] font-mono">
                  {t("common.confidence")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl md:text-3xl font-bold text-white tracking-tight uppercase">
                  {recommendation.primaryAction}
                </span>
                <span className="text-2xl md:text-3xl font-bold text-white font-mono">
                  {recommendation.primaryConfidence}%
                </span>
              </div>
            </div>

            {/* Action Breakdown */}
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#555] block mb-3">
                {t("guide.actionBreakdown")}
              </span>
              <div className="flex flex-col gap-2">
                {recommendation.actions.map((action) => (
                  <div key={action.name} className="flex items-center gap-3">
                    <span className="text-[10px] text-[#999] w-24 tracking-wider uppercase">{action.name}</span>
                    <div className="flex-1 h-[6px] bg-[#1a1a1a] relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-white transition-all duration-300"
                        style={{ width: `${action.percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#666] font-mono w-8 text-right">{action.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reasoning */}
            <div className="px-6 py-4 border-b border-[#1a1a1a]">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#555] block mb-3">
                {t("guide.reasoning")}
              </span>
              <ul className="flex flex-col gap-2">
                {recommendation.reasoning.filter(Boolean).map((r, i) => (
                  <li key={i} className="text-xs text-[#999] leading-relaxed flex gap-2">
                    <span className="text-[#444] shrink-0">&bull;</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sizing Guide */}
            {(recommendation.sizing || recommendation.sprInfo) && (
              <div className="px-6 py-4">
                <span className="text-[10px] tracking-[0.2em] uppercase text-[#555] block mb-2">
                  {t("guide.sizingGuide")}
                </span>
                {recommendation.sizing && (
                  <p className="text-xs text-white font-mono mb-1">{recommendation.sizing}</p>
                )}
                {recommendation.sprInfo && (
                  <p className="text-xs text-[#666] font-mono">{recommendation.sprInfo}</p>
                )}
              </div>
            )}
          </div>
        )}

        {selectedCards.length === 1 && (
          <div className="text-xs text-[#444] text-center py-8">
            {t("guide.selectPrompt")}
          </div>
        )}
      </main>
    </div>
  );
}
