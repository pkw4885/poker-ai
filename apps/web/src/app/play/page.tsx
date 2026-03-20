"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import PokerTable from "@/components/table/PokerTable";
import { createGame, sendAction, startNewHand } from "@/lib/api";
import type { GameStateView, ValidAction, HandResult } from "@/types/game";
import { useI18n, LanguageToggle } from "@/lib/i18n";

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

  const [numOpponents, setNumOpponents] = useState(3);
  const [startingStack] = useState(1000);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const { t } = useI18n();

  const difficultyKeys: Record<Difficulty, "play.easy" | "play.medium" | "play.hard"> = {
    easy: "play.easy",
    medium: "play.medium",
    hard: "play.hard",
  };

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
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <Link
          href="/"
          className="text-xs text-[#666] hover:text-white transition-colors uppercase tracking-wider"
        >
          &larr; {t("common.back")}
        </Link>
        <span className="text-xs font-semibold tracking-widest uppercase text-[#444]">
          {gameId ? `Game ${gameId.slice(0, 8)}` : t("nav.play")}
        </span>
        <LanguageToggle />
      </nav>

      <main className="px-4 pb-8">
        {!gameState ? (
          /* Lobby */
          <div className="flex flex-col items-center pt-16 md:pt-24 gap-10 max-w-sm mx-auto">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                {t("play.title")}
              </h1>
              <p className="text-xs text-[#555] mt-2">
                {t("play.configure")}
              </p>
            </div>

            <div className="flex flex-col gap-6 w-full">
              {/* Opponents */}
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
                    {t("play.opponents")}
                  </label>
                  <span className="text-xs text-white font-mono">
                    {numOpponents}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={numOpponents}
                  onChange={(e) => setNumOpponents(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Difficulty */}
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-3 block">
                  {t("play.difficulty")}
                </label>
                <div className="flex gap-2">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2.5 text-xs font-medium tracking-wider uppercase transition-all border ${
                        difficulty === d
                          ? "bg-white text-black border-white"
                          : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                      }`}
                    >
                      {t(difficultyKeys[d])}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start */}
              <button
                onClick={handleCreateGame}
                disabled={loading}
                className="mt-4 py-3 bg-white text-black font-semibold text-sm tracking-wider uppercase hover:bg-[#e5e5e5] disabled:bg-[#333] disabled:text-[#666] transition-all"
              >
                {loading ? t("play.creating") : t("play.startGame")}
              </button>
            </div>
          </div>
        ) : (
          /* Game table */
          <div className="flex flex-col items-center gap-4 pt-4">
            <PokerTable
              gameState={gameState}
              validActions={validActions}
              isMyTurn={isMyTurn}
              onAction={handleAction}
            />

            {/* Hand results */}
            {handOver && handResults.length > 0 && (
              <div className="flex flex-col items-center gap-3 p-5 bg-[#111] border border-[#222] max-w-md w-full">
                <span className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
                  {t("play.handResult")}
                </span>
                {handResults.map((r, i) => (
                  <div key={i} className="text-sm text-center">
                    <span className="text-[#999]">
                      {r.hand_class === "fold"
                        ? t("play.wonByFold")
                        : `${r.hand_class}`}
                    </span>
                    <span className="text-[#00dc82] ml-2 font-mono">
                      +{r.pot_amount}
                    </span>
                    <span className="text-[#666] ml-1">
                      to{" "}
                      {r.winners
                        .map((w) =>
                          w === 0
                            ? t("play.you")
                            : gameState.players[w]?.name || `Player ${w}`
                        )
                        .join(", ")}
                    </span>
                  </div>
                ))}
                <button
                  onClick={handleNewHand}
                  className="mt-2 px-8 py-2.5 bg-white text-black font-medium text-xs tracking-wider uppercase hover:bg-[#e5e5e5] transition-all"
                >
                  {t("play.nextHand")}
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-[#1a0000] border border-[#441111] text-[#ff4444] text-center text-xs max-w-md mx-auto">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
