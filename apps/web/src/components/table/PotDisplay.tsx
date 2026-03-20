"use client";

import type { PotInfo } from "@/types/game";

interface PotDisplayProps {
  pots: PotInfo[];
  totalPot: number;
}

export default function PotDisplay({ pots, totalPot }: PotDisplayProps) {
  if (totalPot === 0) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-sm md:text-base font-bold text-white font-mono">
        {totalPot.toLocaleString()}
      </div>
      {pots.length > 1 && (
        <div className="flex gap-2">
          {pots.map((pot, i) => (
            <span key={i} className="text-[9px] md:text-[10px] text-[#555] font-mono">
              {pot.name}: {pot.amount.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
