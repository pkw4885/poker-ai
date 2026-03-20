"use client";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { key: "s", symbol: "\u2660", color: "text-gray-900 dark:text-white" },
  { key: "h", symbol: "\u2665", color: "text-red-600" },
  { key: "d", symbol: "\u2666", color: "text-blue-600" },
  { key: "c", symbol: "\u2663", color: "text-green-700" },
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
  const toggleCard = (card: string) => {
    if (selected.includes(card)) {
      onSelect(selected.filter((c) => c !== card));
    } else if (selected.length < maxCards) {
      onSelect([...selected, card]);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {SUITS.map((suit) => (
        <div key={suit.key} className="flex gap-0.5">
          {RANKS.map((rank) => {
            const card = `${rank}${suit.key}`;
            const isSelected = selected.includes(card);
            return (
              <button
                key={card}
                onClick={() => toggleCard(card)}
                className={`w-8 h-10 text-xs font-medium rounded border transition-all flex flex-col items-center justify-center ${
                  isSelected
                    ? "bg-blue-600 border-blue-400 text-white scale-105"
                    : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                }`}
              >
                <span className={isSelected ? "text-white" : "text-gray-300"}>
                  {rank}
                </span>
                <span className={isSelected ? "text-white" : suit.color}>
                  {suit.symbol}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="text-xs text-gray-500 mt-1">
        Selected: {selected.length}/{maxCards} cards
      </div>
    </div>
  );
}
