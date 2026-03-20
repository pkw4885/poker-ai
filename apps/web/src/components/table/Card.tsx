"use client";

import { decodeCard, getSuitSymbol, isRedSuit } from "@/lib/cards";

interface CardProps {
  cardInt?: number;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "w-8 h-11 md:w-10 md:h-14 text-[10px] md:text-xs",
  md: "w-10 h-14 md:w-14 md:h-20 text-xs md:text-sm",
  lg: "w-14 h-20 md:w-18 md:h-26 text-sm md:text-lg",
};

export default function Card({ cardInt, faceDown = false, size = "md" }: CardProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (faceDown || cardInt === undefined) {
    return (
      <div
        className={`${sizeClass} border border-[#333] bg-[#1a1a1a] flex items-center justify-center`}
      >
        <div className="w-3/4 h-3/4 border border-[#333] bg-[#111]" />
      </div>
    );
  }

  const { rank, suit } = decodeCard(cardInt);
  const displayRank = rank === "T" ? "10" : rank;
  const suitSymbol = getSuitSymbol(suit);
  const isRed = isRedSuit(suit);

  return (
    <div
      className={`${sizeClass} border border-[#444] bg-white flex flex-col items-center justify-center relative`}
    >
      <span className={`font-bold leading-none ${isRed ? "text-[#cc0000]" : "text-[#111]"}`}>
        {displayRank}
      </span>
      <span className={`leading-none ${isRed ? "text-[#cc0000]" : "text-[#111]"}`}>
        {suitSymbol}
      </span>
    </div>
  );
}
