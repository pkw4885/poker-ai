"use client";

import type { PlayerView, LastAction } from "@/types/game";
import Card from "./Card";
import { useI18n } from "@/lib/i18n";

const ACTION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  fold: { label: "FOLD", color: "#ff4444", bg: "rgba(255,68,68,0.15)" },
  check: { label: "CHECK", color: "#00dc82", bg: "rgba(0,220,130,0.15)" },
  call: { label: "CALL", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  raise: { label: "RAISE", color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
  all_in: { label: "ALL IN", color: "#ff6b00", bg: "rgba(255,107,0,0.2)" },
};

export function formatChips(amount: number, mode: "won" | "bb" = "won", bb: number = 1): string {
  if (mode === "bb" && bb > 0) {
    const bbs = amount / bb;
    if (bbs >= 100) return `${Math.round(bbs)}BB`;
    return `${bbs.toFixed(1)}BB`;
  }
  // 만원 단위
  if (amount >= 10000) {
    const man = amount / 10000;
    if (man === Math.floor(man)) return `${man}만`;
    return `${man.toFixed(1)}만`;
  }
  return amount.toLocaleString();
}

function ActionBadge({ action, displayMode, bb }: { action: LastAction; displayMode: "won" | "bb"; bb: number }) {
  const style = ACTION_STYLES[action.type] || ACTION_STYLES.check;
  const showAmount = action.amount && action.amount > 0 && action.type !== "fold" && action.type !== "check";
  const label = showAmount
    ? `${style.label} ${formatChips(action.amount!, displayMode, bb)}`
    : style.label;

  return (
    <div
      className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 pointer-events-none"
      style={{
        animation: "actionPop 0.3s ease-out, actionFade 2.5s ease-in forwards",
      }}
    >
      <span
        className="px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold tracking-wider uppercase"
        style={{
          color: style.color,
          backgroundColor: style.bg,
          border: `1px solid ${style.color}40`,
        }}
      >
        {label}
      </span>
    </div>
  );
}

interface PlayerSeatProps {
  player: PlayerView;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isCurrentTurn: boolean;
  isHuman: boolean;
  position: { top: string; left: string };
  seatIndex: number;
  displayMode?: "won" | "bb";
  bigBlind?: number;
}

export default function PlayerSeat({
  player,
  isDealer,
  isSB,
  isBB,
  isCurrentTurn,
  isHuman,
  position,
  seatIndex,
  displayMode = "won",
  bigBlind = 20,
}: PlayerSeatProps) {
  const { t } = useI18n();
  const isFolded = player.status === "folded";
  const isOut = player.status === "out";
  const isAllIn = player.status === "all_in";
  const dimmed = isFolded || isOut;

  return (
    <div
      className={`absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2 ${
        dimmed ? "opacity-30" : ""
      }`}
      style={{ top: position.top, left: position.left }}
    >
      {/* Action badge */}
      {player.last_action && !isOut && (
        <div className="relative w-full">
          <ActionBadge
            key={`${player.id}-${player.last_action.type}-${player.last_action.amount ?? 0}`}
            action={player.last_action}
            displayMode={displayMode}
            bb={bigBlind}
          />
        </div>
      )}

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

      {/* Bet amount - shown between cards and player box, closer to table center */}
      {player.current_bet > 0 && (
        <span className="text-[9px] md:text-[10px] text-[#fbbf24] font-mono font-bold">
          {formatChips(player.current_bet, displayMode, bigBlind)}
        </span>
      )}

      {/* Player info box */}
      <div
        className={`flex flex-col items-center px-2 py-1 md:px-3 md:py-1.5 border bg-[#111] min-w-[60px] md:min-w-[80px] ${
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
        {/* Name + position badges */}
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] md:text-xs text-[#ccc] font-medium truncate max-w-[45px] md:max-w-[65px]">
            {isHuman ? t("seat.you") : player.name}
          </span>
          {isDealer && (
            <span className="text-[7px] md:text-[8px] bg-white text-black font-bold w-3 h-3 md:w-3.5 md:h-3.5 flex items-center justify-center rounded-full">
              D
            </span>
          )}
          {isSB && !isDealer && (
            <span className="text-[7px] md:text-[8px] bg-[#3b82f6] text-white font-bold w-3 h-3 md:w-3.5 md:h-3.5 flex items-center justify-center rounded-full">
              S
            </span>
          )}
          {isBB && (
            <span className="text-[7px] md:text-[8px] bg-[#fbbf24] text-black font-bold w-3 h-3 md:w-3.5 md:h-3.5 flex items-center justify-center rounded-full">
              B
            </span>
          )}
        </div>

        {/* Stack */}
        <span className="text-[9px] md:text-xs text-[#00dc82] font-mono">
          {formatChips(player.stack, displayMode, bigBlind)}
        </span>

        {/* Status */}
        {isAllIn && (
          <span className="text-[7px] md:text-[9px] text-[#fbbf24] font-bold tracking-wider">
            {t("seat.allIn")}
          </span>
        )}
        {isFolded && (
          <span className="text-[7px] md:text-[9px] text-[#555] tracking-wider">
            {t("seat.fold")}
          </span>
        )}
      </div>
    </div>
  );
}
