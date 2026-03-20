"use client";

import { useState, useCallback } from "react";
import type { ValidAction } from "@/types/game";

interface ActionPanelProps {
  validActions: ValidAction[];
  isMyTurn: boolean;
  onAction: (type: string, amount?: number) => void;
}

export default function ActionPanel({
  validActions,
  isMyTurn,
  onAction,
}: ActionPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState(0);

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

  if (!isMyTurn) {
    return (
      <div className="flex items-center justify-center h-20">
        <span className="text-gray-500 text-sm animate-pulse">
          Waiting for opponents...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-gray-800/80 rounded-xl border border-gray-700">
      <div className="flex gap-3">
        {foldAction && (
          <button
            onClick={() => onAction("fold")}
            className="px-6 py-2 bg-red-700 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
          >
            Fold
          </button>
        )}
        {checkAction && (
          <button
            onClick={() => onAction("check")}
            className="px-6 py-2 bg-green-700 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
          >
            Check
          </button>
        )}
        {callAction && (
          <button
            onClick={() => onAction("call")}
            className="px-6 py-2 bg-blue-700 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            Call {callAction.amount}
          </button>
        )}
        {raiseAction && (
          <button
            onClick={handleRaise}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-medium rounded-lg transition-colors"
          >
            Raise {raiseAmount || minRaise}
          </button>
        )}
      </div>

      {raiseAction && (
        <div className="flex items-center gap-3 w-full max-w-md">
          <span className="text-xs text-gray-400">{minRaise}</span>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount || minRaise}
            onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
            className="flex-1 accent-yellow-500"
          />
          <span className="text-xs text-gray-400">{maxRaise}</span>
          <button
            onClick={() => onAction("all_in")}
            className="px-3 py-1 text-xs bg-red-800 hover:bg-red-700 text-white rounded transition-colors"
          >
            All In
          </button>
        </div>
      )}
    </div>
  );
}
