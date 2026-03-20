"use client";

import { useState, useCallback } from "react";
import type { ValidAction } from "@/types/game";
import { useI18n } from "@/lib/i18n";
import { formatChips } from "./PlayerSeat";

interface ActionPanelProps {
  validActions: ValidAction[];
  isMyTurn: boolean;
  onAction: (type: string, amount?: number) => void;
  displayMode?: "won" | "bb";
  bigBlind?: number;
}

export default function ActionPanel({
  validActions,
  isMyTurn,
  onAction,
  displayMode = "won",
  bigBlind = 20,
}: ActionPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState(0);
  const { t } = useI18n();

  const foldAction = validActions.find((a) => a.type === "fold");
  const checkAction = validActions.find((a) => a.type === "check");
  const callAction = validActions.find((a) => a.type === "call");
  const raiseAction = validActions.find((a) => a.type === "raise");

  const minRaise = raiseAction?.min_amount || 0;
  const maxRaise = raiseAction?.max_amount || 0;

  const handleRaise = useCallback(() => {
    const amount = raiseAmount || minRaise;
    onAction("raise", amount);
  }, [raiseAmount, minRaise, onAction]);

  const fmt = (v: number) => formatChips(v, displayMode, bigBlind);

  if (!isMyTurn) {
    return (
      <div className="flex items-center justify-center h-12 md:h-16">
        <span className="text-[10px] text-[#444] tracking-[0.2em] uppercase animate-pulse">
          {t("action.waiting")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 p-3 md:p-4 bg-[#111] border border-[#222] w-full max-w-lg mx-auto">
      {/* Action buttons */}
      <div className="flex gap-2 w-full">
        {foldAction && (
          <button
            onClick={() => onAction("fold")}
            className="flex-1 py-2 text-xs font-medium tracking-wider uppercase bg-transparent border border-[#333] text-[#666] hover:border-[#ff4444] hover:text-[#ff4444] transition-all"
          >
            {t("action.fold")}
          </button>
        )}
        {checkAction && (
          <button
            onClick={() => onAction("check")}
            className="flex-1 py-2 text-xs font-medium tracking-wider uppercase bg-transparent border border-[#333] text-[#999] hover:border-[#00dc82] hover:text-[#00dc82] transition-all"
          >
            {t("action.check")}
          </button>
        )}
        {callAction && (
          <button
            onClick={() => onAction("call")}
            className="flex-1 py-2 text-xs font-medium tracking-wider uppercase bg-transparent border border-[#333] text-[#999] hover:border-white hover:text-white transition-all"
          >
            {t("action.call")} {fmt(callAction.amount || 0)}
          </button>
        )}
        {raiseAction && (
          <button
            onClick={handleRaise}
            className="flex-1 py-2 text-xs font-medium tracking-wider uppercase bg-white text-black border border-white hover:bg-[#e5e5e5] transition-all"
          >
            {t("action.raise")} {fmt(raiseAmount || minRaise)}
          </button>
        )}
      </div>

      {/* Raise slider */}
      {raiseAction && (
        <div className="flex items-center gap-2 w-full">
          <span className="text-[9px] text-[#555] font-mono w-12 text-right">
            {fmt(minRaise)}
          </span>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount || minRaise}
            onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-[9px] text-[#555] font-mono w-12">
            {fmt(maxRaise)}
          </span>
          <button
            onClick={() => onAction("all_in")}
            className="px-2 py-1 text-[9px] font-medium tracking-wider uppercase border border-[#fbbf24] text-[#fbbf24] hover:bg-[#fbbf24] hover:text-black transition-all"
          >
            {t("action.allIn")}
          </button>
        </div>
      )}
    </div>
  );
}
