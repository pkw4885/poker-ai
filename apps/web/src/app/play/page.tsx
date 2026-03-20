"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import PokerTable from "@/components/table/PokerTable";
import { createGame, sendAction, startNewHand } from "@/lib/api";
import type { GameStateView, ValidAction, HandResult } from "@/types/game";

type Difficulty = "easy" | "medium" | "hard";

interface GameResponse {
  game_id?: string;
  game_state: GameStateView;
  valid_actions: ValidAction[];
  is_my_turn: boolean;
  hand_over: boolean;
  hand_results?: HandResult[];
}

export default function PlayPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameStateView | null>(null);
  const [validActions, setValidActions] = useState<ValidAction[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [handOver, setHandOver] = useState(false);
  const [handResults, setHandResults] = useState<HandResult[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Config
  const [numOpponents, setNumOpponents] = useState(3);
  const [startingStack] = useState(1000);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const applyResponse = useCallback((res: GameResponse) => {
    setGameState(res.game_state);
    setValidActions(res.valid_actions || []);
    setIsMyTurn(res.is_my_turn);
    setHandOver(res.hand_over);
    if (res.hand_results) setHandResults(res.hand_results);
  }, []);

  const handleCreateGame = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await createGame({
        numOpponents,
        startingStack,
        smallBlind: 5,
        bigBlind: 10,
        difficulty,
      });
      setGameId(res.game_id);
      applyResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  }, [numOpponents, startingStack, difficulty, applyResponse]);

  const handleAction = useCallback(
    async (actionType: string, amount?: number) => {
      if (!gameId) return;
      setError("");
      try {
        const res = await sendAction(gameId, actionType, amount || 0);
        applyResponse(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    },
    [gameId, applyResponse]
  );

  const handleNewHand = useCallback(async () => {
    if (!gameId) return;
    setError("");
    setHandResults([]);
    try {
      const res = await startNewHand(gameId);
      applyResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start new hand");
    }
  }, [gameId, applyResponse]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <header className="p-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </Link>
        {gameId && (
          <span className="text-xs text-gray-500">Game: {gameId}</span>
        )}
      </header>

      <main className="px-4 pb-8">
        {!gameState ? (
          /* Lobby */
          <div className="flex flex-col items-center pt-12 gap-8">
            <h1 className="text-3xl font-bold">Play vs AI</h1>

            <div className="flex flex-col gap-4 w-full max-w-sm">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-400">
                  Opponents: {numOpponents}
                </span>
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={numOpponents}
                  onChange={(e) => setNumOpponents(parseInt(e.target.value))}
                  className="accent-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-400">Difficulty</span>
                <div className="flex gap-2">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        difficulty === d
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </label>

              <button
                onClick={handleCreateGame}
                disabled={loading}
                className="mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white font-bold rounded-xl text-lg transition-colors"
              >
                {loading ? "Creating..." : "Start Game"}
              </button>
            </div>
          </div>
        ) : (
          /* Game table */
          <div className="flex flex-col items-center gap-4">
            <PokerTable
              gameState={gameState}
              validActions={validActions}
              isMyTurn={isMyTurn}
              onAction={handleAction}
            />

            {/* Hand results */}
            {handOver && handResults.length > 0 && (
              <div className="flex flex-col items-center gap-3 p-4 bg-gray-800/80 rounded-xl border border-gray-700 max-w-md w-full">
                <h3 className="text-lg font-bold text-yellow-400">
                  Hand Result
                </h3>
                {handResults.map((r, i) => (
                  <div key={i} className="text-sm text-center">
                    <span className="text-gray-300">
                      {r.hand_class === "fold"
                        ? "Won by fold"
                        : `${r.hand_class}`}
                    </span>
                    <span className="text-emerald-400 ml-2">
                      +{r.pot_amount} to{" "}
                      {r.winners
                        .map((w) =>
                          w === 0
                            ? "You"
                            : gameState.players[w]?.name || `Player ${w}`
                        )
                        .join(", ")}
                    </span>
                  </div>
                ))}
                <button
                  onClick={handleNewHand}
                  className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                >
                  Next Hand
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-center text-sm max-w-md mx-auto">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
