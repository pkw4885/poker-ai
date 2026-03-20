"use client";

import Card from "./Card";

interface CommunityCardsProps {
  board: number[];
}

export default function CommunityCards({ board }: CommunityCardsProps) {
  const cards = [...board];
  while (cards.length < 5) {
    cards.push(-1);
  }

  return (
    <div className="flex gap-1 md:gap-2 justify-center">
      {cards.map((card, i) => (
        <div key={i} className={card === -1 ? "opacity-15" : ""}>
          {card === -1 ? (
            <div className="w-10 h-14 md:w-14 md:h-20 border border-dashed border-[#333]" />
          ) : (
            <Card cardInt={card} size="md" />
          )}
        </div>
      ))}
    </div>
  );
}
