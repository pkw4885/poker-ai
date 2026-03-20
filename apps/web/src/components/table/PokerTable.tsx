"use client";

import { useState, useEffect } from "react";
import type { GameStateView, ValidAction } from "@/types/game";
import PlayerSeat, { formatChips } from "./PlayerSeat";
import CommunityCards from "./CommunityCards";
import ActionPanel from "./ActionPanel";
import TurnTimer from "./TurnTimer";
import { useI18n } from "@/lib/i18n";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

interface PokerTableProps {
  gameState: GameStateView;
  validActions: ValidAction[];
  isMyTurn: boolean;
  onAction: (type: string, amount?: number) => void;
  turnDuration?: number;
  turnKey?: number; // unique key to force timer reset
  displayMode?: "won" | "bb";
  onToggleDisplay?: () => void;
}

const SEAT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  2: [
    { top: "85%", left: "50%" },
    { top: "15%", left: "50%" },
  ],
  3: [
    { top: "85%", left: "50%" },
    { top: "25%", left: "20%" },
    { top: "25%", left: "80%" },
  ],
  4: [
    { top: "85%", left: "50%" },
    { top: "50%", left: "8%" },
    { top: "15%", left: "50%" },
    { top: "50%", left: "92%" },
  ],
  5: [
    { top: "85%", left: "50%" },
    { top: "65%", left: "8%" },
    { top: "25%", left: "20%" },
    { top: "25%", left: "80%" },
    { top: "65%", left: "92%" },
  ],
  6: [
    { top: "85%", left: "50%" },
    { top: "65%", left: "8%" },
    { top: "25%", left: "12%" },
    { top: "15%", left: "50%" },
    { top: "25%", left: "88%" },
    { top: "65%", left: "92%" },
  ],
  7: [
    { top: "85%", left: "50%" },
    { top: "70%", left: "8%" },
    { top: "35%", left: "8%" },
    { top: "15%", left: "30%" },
    { top: "15%", left: "70%" },
    { top: "35%", left: "92%" },
    { top: "70%", left: "92%" },
  ],
  8: [
    { top: "85%", left: "50%" },
    { top: "70%", left: "8%" },
    { top: "35%", left: "8%" },
    { top: "15%", left: "25%" },
    { top: "15%", left: "50%" },
    { top: "15%", left: "75%" },
    { top: "35%", left: "92%" },
    { top: "70%", left: "92%" },
  ],
};

const MOBILE_SEAT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  2: [
    { top: "88%", left: "50%" },
    { top: "10%", left: "50%" },
  ],
  3: [
    { top: "88%", left: "50%" },
    { top: "18%", left: "22%" },
    { top: "18%", left: "78%" },
  ],
  4: [
    { top: "88%", left: "50%" },
    { top: "50%", left: "5%" },
    { top: "10%", left: "50%" },
    { top: "50%", left: "95%" },
  ],
  5: [
    { top: "88%", left: "50%" },
    { top: "62%", left: "5%" },
    { top: "18%", left: "22%" },
    { top: "18%", left: "78%" },
    { top: "62%", left: "95%" },
  ],
  6: [
    { top: "88%", left: "50%" },
    { top: "65%", left: "5%" },
    { top: "25%", left: "8%" },
    { top: "10%", left: "50%" },
    { top: "25%", left: "92%" },
    { top: "65%", left: "95%" },
  ],
  7: [
    { top: "90%", left: "50%" },
    { top: "72%", left: "5%" },
    { top: "42%", left: "3%" },
    { top: "15%", left: "25%" },
    { top: "15%", left: "75%" },
    { top: "42%", left: "97%" },
    { top: "72%", left: "95%" },
  ],
  8: [
    { top: "90%", left: "50%" },
    { top: "72%", left: "5%" },
    { top: "42%", left: "3%" },
    { top: "15%", left: "22%" },
    { top: "8%", left: "50%" },
    { top: "15%", left: "78%" },
    { top: "42%", left: "97%" },
    { top: "72%", left: "95%" },
  ],
};

export default function PokerTable({
  gameState,
  validActions,
  isMyTurn,
  onAction,
  turnDuration = 30,
  turnKey = 0,
  displayMode = "won",
  onToggleDisplay,
}: PokerTableProps) {
  const isMobile = useIsMobile();
  const numPlayers = gameState.players.length;
  const positionMap = isMobile ? MOBILE_SEAT_POSITIONS : SEAT_POSITIONS;
  const positions = positionMap[numPlayers] || positionMap[8];
  const { t } = useI18n();

  const handleTimeout = () => {
    if (isMyTurn) {
      onAction("fold");
    }
  };

  const phaseKey = `phase.${gameState.phase}` as const;
  const bb = gameState.big_blind || 20;
  const sb = gameState.small_blind || 10;
  const totalPot = gameState.total_pot;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-4xl mx-auto">
      {/* Blind level + display toggle */}
      <div className="flex items-center justify-between w-full max-w-lg px-2">
        <div className="text-[10px] text-[#666] font-mono tracking-wider">
          {t("table.hand")} #{gameState.hand_number} &middot; {t(phaseKey)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#fbbf24] font-mono">
            SB/BB {formatChips(sb, displayMode, bb)}/{formatChips(bb, displayMode, bb)}
          </span>
          {onToggleDisplay && (
            <button
              onClick={onToggleDisplay}
              className="text-[9px] px-1.5 py-0.5 border border-[#333] text-[#666] hover:text-white hover:border-[#555] transition-colors uppercase tracking-wider"
            >
              {displayMode === "won" ? "BB" : "₩"}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="relative w-full aspect-[3/4] md:aspect-[16/10] max-h-[55vh] md:max-h-[480px]">
        {/* Table surface */}
        <div className="absolute inset-[5%] rounded-[50%] bg-gradient-to-b from-[#0d1f0d] to-[#0a1a0a] border-2 border-[#1a2e1a] shadow-[0_0_60px_rgba(0,0,0,0.5)]" />
        <div className="absolute inset-[10%] rounded-[50%] border border-[#1a2e1a]/50" />

        {/* Community cards + pot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
          <CommunityCards board={gameState.board} />
          {/* Pot display */}
          {totalPot > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-[#888] uppercase tracking-wider">POT</span>
              <span className="text-sm md:text-base font-bold text-white font-mono">
                {formatChips(totalPot, displayMode, bb)}
              </span>
            </div>
          )}
        </div>

        {/* Player seats */}
        {gameState.players.map((player, i) => (
          <PlayerSeat
            key={player.id}
            player={player}
            isDealer={i === gameState.dealer_pos}
            isSB={i === gameState.small_blind_pos}
            isBB={i === gameState.big_blind_pos}
            isCurrentTurn={i === gameState.current_player_idx && gameState.phase !== "hand_over"}
            isHuman={i === 0}
            position={positions[i] || { top: "50%", left: "50%" }}
            seatIndex={i}
            displayMode={displayMode}
            bigBlind={bb}
            isMobile={isMobile}
          />
        ))}
      </div>

      {/* Turn timer - key forces remount to reset */}
      <TurnTimer
        key={turnKey}
        duration={turnDuration}
        isActive={isMyTurn}
        onTimeout={handleTimeout}
      />

      {/* Action panel */}
      <ActionPanel
        validActions={validActions}
        isMyTurn={isMyTurn}
        onAction={onAction}
        displayMode={displayMode}
        bigBlind={bb}
        totalPot={totalPot}
      />
    </div>
  );
}
