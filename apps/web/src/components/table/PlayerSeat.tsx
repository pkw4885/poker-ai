"use client";

import type { PlayerView } from "@/types/game";
import Card from "./Card";
import { useI18n } from "@/lib/i18n";

interface PlayerSeatProps {
  player: PlayerView;
  isDealer: boolean;
  isCurrentTurn: boolean;
  isHuman: boolean;
  position: { top: string; left: string };
  seatIndex: number;
}

export default function PlayerSeat({
  player,
  isDealer,
  isCurrentTurn,
  isHuman,
  position,
  seatIndex,
}: PlayerSeatProps) {
  const { t } = useI18n();
  const isFolded = player.status === "folded";
  const isOut = player.status === "out";
  const isAllIn = player.status === "all_in";
  const dimmed = isFolded || isOut;

  return (
    <div
      className={`absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2 ${
        dimmed ? "opacity-30" : ""
      }`}
      style={{ top: position.top, left: position.left }}
    >
      {/* Cards */}
      <div className="flex gap-0.5">
        {player.hole_cards.length > 0 ? (
          player.hole_cards.map((card, i) => (
            <Card
              key={i}
              cardInt={card}
              size="sm"
              dealDelay={seatIndex * 200 + i * 100}
            />
          ))
        ) : !isFolded && !isOut ? (
          <>
            <Card faceDown size="sm" dealDelay={seatIndex * 200} />
            <Card faceDown size="sm" dealDelay={seatIndex * 200 + 100} />
          </>
        ) : null}
      </div>

      {/* Player info */}
      <div
        className={`flex flex-col items-center px-2 py-1.5 md:px-3 md:py-2 border bg-[#111] min-w-[60px] md:min-w-[80px] ${
          isCurrentTurn
            ? "border-white"
            : isAllIn
              ? "border-[#fbbf24]"
              : "border-[#222]"
        }`}
        style={
          isCurrentTurn
            ? { animation: "turnPulse 1.5s ease-in-out infinite" }
            : undefined
        }
      >
        <div className="flex items-center gap-1">
          <span className="text-[10px] md:text-xs text-[#ccc] font-medium truncate max-w-[50px] md:max-w-[70px]">
            {isHuman ? t("seat.you") : player.name}
          </span>
          {isDealer && (
            <span className="text-[8px] md:text-[10px] bg-white text-black font-bold w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center">
              D
            </span>
          )}
        </div>
        <span className="text-[10px] md:text-xs text-[#00dc82] font-mono">
          {player.stack.toLocaleString()}
        </span>
        {player.current_bet > 0 && (
          <span className="text-[8px] md:text-[10px] text-[#fbbf24] font-mono">
            {player.current_bet}
          </span>
        )}
        {isAllIn && (
          <span className="text-[8px] md:text-[10px] text-[#fbbf24] font-bold tracking-wider">
            {t("seat.allIn")}
          </span>
        )}
        {isFolded && (
          <span className="text-[8px] md:text-[10px] text-[#555] tracking-wider">
            {t("seat.fold")}
          </span>
        )}
      </div>
    </div>
  );
}
