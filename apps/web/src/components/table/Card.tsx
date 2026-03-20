"use client";

import { decodeCard, getSuitSymbol, isRedSuit } from "@/lib/cards";

interface CardProps {
  cardInt?: number;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "w-10 h-14 text-xs",
  md: "w-14 h-20 text-sm",
  lg: "w-18 h-26 text-lg",
};

export default function Card({ cardInt, faceDown = false, size = "md" }: CardProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (faceDown || cardInt === undefined) {
    return (
      <div
        className={`${sizeClass} rounded-lg border-2 border-gray-600 bg-gradient-to-br from-blue-800 to-blue-900 flex items-center justify-center shadow-lg`}
      >
        <div className="w-3/4 h-3/4 border border-blue-400/30 rounded-sm bg-blue-700/50" />
      </div>
    );
  }

  const { rank, suit } = decodeCard(cardInt);
  const displayRank = rank === "T" ? "10" : rank;
  const suitSymbol = getSuitSymbol(suit);
  const colorClass = isRedSuit(suit) ? "text-red-600" : "text-gray-900";

  return (
    <div
      className={`${sizeClass} rounded-lg border-2 border-gray-300 bg-white flex flex-col items-center justify-center shadow-lg relative`}
    >
      <span className={`font-bold ${colorClass} leading-none`}>
        {displayRank}
      </span>
      <span className={`${colorClass} leading-none`}>
        {suitSymbol}
      </span>
    </div>
  );
}
