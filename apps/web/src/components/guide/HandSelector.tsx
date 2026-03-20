"use client";

import { useI18n } from "@/lib/i18n";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { key: "s", symbol: "\u2660", color: "text-white" },
  { key: "h", symbol: "\u2665", color: "text-[#ff4444]" },
  { key: "d", symbol: "\u2666", color: "text-[#3b82f6]" },
  { key: "c", symbol: "\u2663", color: "text-[#00dc82]" },
];

interface HandSelectorProps {
  selected: string[];
  onSelect: (cards: string[]) => void;
  maxCards?: number;
}

export default function HandSelector({
  selected,
  onSelect,
  maxCards = 2,
}: HandSelectorProps) {
  const { t } = useI18n();

  const toggleCard = (card: string) => {
    if (selected.includes(card)) {
      onSelect(selected.filter((c) => c !== card));
    } else if (selected.length < maxCards) {
      onSelect([...selected, card]);
    }
  };

  return (
    <div className="flex flex-col gap-[2px]">
      {SUITS.map((suit) => (
        <div key={suit.key} className="flex gap-[2px]">
          {RANKS.map((rank) => {
            const card = `${rank}${suit.key}`;
            const isSelected = selected.includes(card);
            return (
              <button
                key={card}
                onClick={() => toggleCard(card)}
                className={`w-7 h-9 md:w-9 md:h-11 text-[10px] md:text-xs font-medium transition-all flex flex-col items-center justify-center border ${
                  isSelected
                    ? "bg-white border-white text-black"
                    : "bg-[#111] border-[#222] hover:border-[#444]"
                }`}
              >
                <span className={isSelected ? "text-black font-bold" : "text-[#999]"}>
                  {rank}
                </span>
                <span
                  className={
                    isSelected ? "text-black text-[8px] md:text-[10px]" : `${suit.color} text-[8px] md:text-[10px]`
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
