"use client";

import type { PlayerView } from "@/types/game";
import Card from "./Card";

interface PlayerSeatProps {
  player: PlayerView;
  isDealer: boolean;
  isCurrentTurn: boolean;
  isHuman: boolean;
  position: { top: string; left: string };
}

const STATUS_COLORS: Record<string, string> = {
  active: "border-green-500",
  folded: "border-gray-600 opacity-50",
  all_in: "border-yellow-500",
  out: "border-gray-800 opacity-30",
};

export default function PlayerSeat({
  player,
  isDealer,
  isCurrentTurn,
  isHuman,
  position,
}: PlayerSeatProps) {
  const statusColor = STATUS_COLORS[player.status] || "border-gray-500";
  const turnGlow = isCurrentTurn ? "ring-2 ring-yellow-400 ring-opacity-75" : "";

  return (
    <div
      className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2"
      style={{ top: position.top, left: position.left }}
    >
      {/* Cards */}
      <div className="flex gap-0.5">
        {player.hole_cards.length > 0 ? (
          player.hole_cards.map((card, i) => (
            <Card key={i} cardInt={card} size="sm" />
          ))
        ) : player.status !== "folded" && player.status !== "out" ? (
          <>
            <Card faceDown size="sm" />
            <Card faceDown size="sm" />
          </>
        ) : null}
      </div>

      {/* Player info box */}
      <div
        className={`flex flex-col items-center px-3 py-1.5 rounded-lg border-2 ${statusColor} ${turnGlow} bg-gray-800/90 min-w-[80px]`}
      >
        <div className="flex items-center gap-1">
          <span className="text-xs text-white font-medium truncate max-w-[70px]">
            {isHuman ? "You" : player.name}
          </span>
          {isDealer && (
            <span className="text-[10px] bg-yellow-500 text-black font-bold rounded-full w-4 h-4 flex items-center justify-center">
              D
            </span>
          )}
        </div>
        <span className="text-xs text-emerald-400 font-mono">
          {player.stack.toLocaleString()}
        </span>
        {player.current_bet > 0 && (
          <span className="text-[10px] text-yellow-300">
            Bet: {player.current_bet}
          </span>
        )}
        {player.status === "all_in" && (
          <span className="text-[10px] text-yellow-500 font-bold">ALL IN</span>
        )}
        {player.status === "folded" && (
          <span className="text-[10px] text-gray-500">FOLD</span>
        )}
      </div>
    </div>
  );
}
