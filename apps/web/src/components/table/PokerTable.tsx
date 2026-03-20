"use client";

import type { GameStateView, ValidAction } from "@/types/game";
import PlayerSeat from "./PlayerSeat";
import CommunityCards from "./CommunityCards";
import PotDisplay from "./PotDisplay";
import ActionPanel from "./ActionPanel";

interface PokerTableProps {
  gameState: GameStateView;
  validActions: ValidAction[];
  isMyTurn: boolean;
  onAction: (type: string, amount?: number) => void;
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

export default function PokerTable({
  gameState,
  validActions,
  isMyTurn,
  onAction,
}: PokerTableProps) {
  const numPlayers = gameState.players.length;
  const positions = SEAT_POSITIONS[numPlayers] || SEAT_POSITIONS[8];

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl mx-auto">
      {/* Table */}
      <div className="relative w-full aspect-[16/10] max-h-[420px] md:max-h-[500px]">
        {/* Table surface — dark felt */}
        <div className="absolute inset-[5%] rounded-[50%] bg-gradient-to-b from-[#0d1f0d] to-[#0a1a0a] border-2 border-[#1a2e1a] shadow-[0_0_60px_rgba(0,0,0,0.5)]" />

        {/* Inner line */}
        <div className="absolute inset-[10%] rounded-[50%] border border-[#1a2e1a]/50" />

        {/* Community cards + pot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <CommunityCards board={gameState.board} />
          <PotDisplay pots={gameState.pots} totalPot={gameState.total_pot} />
        </div>

        {/* Player seats */}
        {gameState.players.map((player, i) => (
          <PlayerSeat
            key={player.id}
            player={player}
            isDealer={i === gameState.dealer_pos}
            isCurrentTurn={i === gameState.current_player_idx}
            isHuman={i === 0}
            position={positions[i] || { top: "50%", left: "50%" }}
          />
        ))}
      </div>

      {/* Action panel */}
      <ActionPanel
        validActions={validActions}
        isMyTurn={isMyTurn}
        onAction={onAction}
      />

      {/* Phase indicator */}
      <div className="text-[10px] text-[#444] tracking-[0.2em] uppercase">
        Hand #{gameState.hand_number} &middot; {formatPhase(gameState.phase)}
      </div>
    </div>
  );
}

function formatPhase(phase: string): string {
  const labels: Record<string, string> = {
    waiting: "Waiting",
    deal_hole: "Dealing",
    preflop_bet: "Pre-Flop",
    flop_bet: "Flop",
    turn_bet: "Turn",
    river_bet: "River",
    showdown: "Showdown",
    hand_over: "Hand Over",
  };
  return labels[phase] || phase;
}
