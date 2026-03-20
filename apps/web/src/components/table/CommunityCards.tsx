"use client";

import Card from "./Card";

interface CommunityCardsProps {
  board: number[];
}

export default function CommunityCards({ board }: CommunityCardsProps) {
  // Always show 5 card slots
  const cards = [...board];
  while (cards.length < 5) {
    cards.push(-1);
  }

  return (
    <div className="flex gap-2 justify-center">
      {cards.map((card, i) => (
        <div key={i} className={card === -1 ? "opacity-20" : ""}>
          {card === -1 ? (
            <div className="w-14 h-20 rounded-lg border-2 border-dashed border-gray-600" />
          ) : (
            <Card cardInt={card} size="md" />
          )}
        </div>
      ))}
    </div>
  );
}
