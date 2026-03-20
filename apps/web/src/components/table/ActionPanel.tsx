"use client";

import { useState, useCallback, useEffect } from "react";
import type { ValidAction } from "@/types/game";
import { useI18n } from "@/lib/i18n";
import { formatChips } from "./PlayerSeat";

interface ActionPanelProps {
  validActions: ValidAction[];
  isMyTurn: boolean;
  onAction: (type: string, amount?: number) => void;
  displayMode?: "won" | "bb";
  bigBlind?: number;
  totalPot?: number;
}

export default function ActionPanel({
  validActions,
  isMyTurn,
  onAction,
  displayMode = "won",
  bigBlind = 20,
  totalPot = 0,
}: ActionPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState(0);
  const { t } = useI18n();

  const foldAction = validActions.find((a) => a.type === "fold");
  const checkAction = validActions.find((a) => a.type === "check");
  const callAction = validActions.find((a) => a.type === "call");
  const raiseAction = validActions.find((a) => a.type === "raise");

  const minRaise = raiseAction?.min_amount || 0;
  const maxRaise = raiseAction?.max_amount || 0;

  // Reset raise amount when new turn starts
  useEffect(() => {
    if (isMyTurn && raiseAction) {
      setRaiseAmount(minRaise);
    }
  }, [isMyTurn, minRaise, raiseAction]);

  const clampRaise = useCallback(
    (val: number) => Math.max(minRaise, Math.min(maxRaise, val)),
    [minRaise, maxRaise]
  );

  const handleRaise = useCallback(() => {
    const amount = raiseAmount || minRaise;
    onAction("raise", amount);
  }, [raiseAmount, minRaise, onAction]);

  const fmt = (v: number) => formatChips(v, displayMode, bigBlind);

  // Preset calculations
  const presets = raiseAction
    ? [
        { label: "2BB", value: clampRaise(bigBlind * 2) },
        { label: "¼", value: clampRaise(Math.floor(totalPot * 0.25)) },
        { label: "⅓", value: clampRaise(Math.floor(totalPot / 3)) },
        { label: "⅔", value: clampRaise(Math.floor((totalPot * 2) / 3)) },
        { label: "POT", value: clampRaise(totalPot) },
      ].filter((p) => p.value >= minRaise && p.value <= maxRaise)
    : [];

  // +/- step: use BB increments, bigger steps for larger stacks
  const step = bigBlind;

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
    <div className="flex flex-col items-center gap-1.5 md:gap-2 p-2 md:p-4 bg-[#111] border border-[#222] w-full max-w-lg mx-auto">
      {/* Action buttons */}
      <div className="flex gap-1.5 md:gap-2 w-full">
        {foldAction && (
          <button
            onClick={() => onAction("fold")}
            className="flex-1 py-1.5 md:py-2 text-[10px] md:text-xs font-medium tracking-wider uppercase bg-transparent border border-[#333] text-[#666] hover:border-[#ff4444] hover:text-[#ff4444] transition-all"
          >
            {t("action.fold")}
          </button>
        )}
        {checkAction && (
          <button
            onClick={() => onAction("check")}
            className="flex-1 py-1.5 md:py-2 text-[10px] md:text-xs font-medium tracking-wider uppercase bg-transparent border border-[#333] text-[#999] hover:border-[#00dc82] hover:text-[#00dc82] transition-all"
          >
            {t("action.check")}
          </button>
        )}
        {callAction && (
          <button
            onClick={() => onAction("call")}
            className="flex-1 py-1.5 md:py-2 text-[10px] md:text-xs font-medium tracking-wider uppercase bg-transparent border border-[#333] text-[#999] hover:border-white hover:text-white transition-all"
          >
            {t("action.call")} {fmt(callAction.amount || 0)}
          </button>
        )}
        {raiseAction && (
          <button
            onClick={handleRaise}
            className="flex-1 py-1.5 md:py-2 text-[10px] md:text-xs font-medium tracking-wider uppercase bg-white text-black border border-white hover:bg-[#e5e5e5] transition-all"
          >
            {t("action.raise")} {fmt(raiseAmount || minRaise)}
          </button>
        )}
      </div>

      {/* Raise controls */}
      {raiseAction && (
        <>
          {/* Preset buttons */}
          <div className="flex gap-1 w-full">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setRaiseAmount(p.value)}
                className={`flex-1 py-1 text-[9px] md:text-[10px] font-bold tracking-wider uppercase border transition-all ${
                  raiseAmount === p.value
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-[#888] border-[#333] hover:border-[#666] hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Slider + /- buttons */}
          <div className="flex items-center gap-1 md:gap-1.5 w-full">
            <button
              onClick={() => setRaiseAmount(clampRaise((raiseAmount || minRaise) - step))}
              className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-sm md:text-base font-bold border border-[#333] text-[#999] hover:border-white hover:text-white transition-all"
            >
              −
            </button>
            <span className="text-[8px] md:text-[9px] text-[#555] font-mono w-8 md:w-10 text-right">
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
            <span className="text-[8px] md:text-[9px] text-[#555] font-mono w-8 md:w-10">
              {fmt(maxRaise)}
            </span>
            <button
              onClick={() => setRaiseAmount(clampRaise((raiseAmount || minRaise) + step))}
              className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-sm md:text-base font-bold border border-[#333] text-[#999] hover:border-white hover:text-white transition-all"
            >
              +
            </button>
            <button
              onClick={() => onAction("all_in")}
              className="px-1.5 md:px-2 py-1 text-[8px] md:text-[9px] font-medium tracking-wider uppercase border border-[#fbbf24] text-[#fbbf24] hover:bg-[#fbbf24] hover:text-black transition-all"
            >
              {t("action.allIn")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
