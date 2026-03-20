"use client";

import { useRef, useEffect, useState } from "react";
import Card from "./Card";

interface CommunityCardsProps {
  board: number[];
}

export default function CommunityCards({ board }: CommunityCardsProps) {
  const [prevCount, setPrevCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    prevCountRef.current = prevCount;
    setPrevCount(board.length);
  }, [board.length, prevCount]);

  const cards = [...board];
  while (cards.length < 5) {
    cards.push(-1);
  }

  const newCardsStart = prevCountRef.current;

  return (
    <div className="flex gap-1 md:gap-2 justify-center">
      {cards.map((card, i) => {
        const isNew = card !== -1 && i >= newCardsStart;
        return (
          <div key={i} className={card === -1 ? "opacity-15" : ""}>
            {card === -1 ? (
              <div className="w-10 h-14 md:w-14 md:h-20 border border-dashed border-[#333]" />
            ) : (
              <Card
                cardInt={card}
                size="md"
                dealDelay={isNew ? (i - newCardsStart) * 150 : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
