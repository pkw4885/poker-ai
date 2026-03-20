"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import PokerTable from "@/components/table/PokerTable";
import { createGame, sendAction, startNewHand } from "@/lib/api";
import type { GameStateView, ValidAction, HandResult, AIAction } from "@/types/game";
import { useI18n, LanguageToggle } from "@/lib/i18n";
import { formatChips } from "@/components/table/PlayerSeat";

type Difficulty = "easy" | "medium" | "hard";

interface GameResponse {
  game_id?: string;
  game_state: GameStateView;
  valid_actions: ValidAction[];
  is_my_turn: boolean;
  hand_over: boolean;
  hand_results?: HandResult[];
  ai_actions?: AIAction[];
}

const AI_ACTION_DELAY = 800; // ms between each AI action animation

export default function PlayPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameStateView | null>(null);
  const [validActions, setValidActions] = useState<ValidAction[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [handOver, setHandOver] = useState(false);
  const [handResults, setHandResults] = useState<HandResult[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [turnKey, setTurnKey] = useState(0);
  const [displayMode, setDisplayMode] = useState<"won" | "bb">("won");

  const [numOpponents, setNumOpponents] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const { t } = useI18n();
  const animatingRef = useRef(false);

  const difficultyKeys: Record<Difficulty, "play.easy" | "play.medium" | "play.hard"> = {
    easy: "play.easy",
    medium: "play.medium",
    hard: "play.hard",
  };

  // Animate AI actions sequentially, then apply final state
  const animateAIActions = useCallback(
    (aiActions: AIAction[], finalResponse: GameResponse) => {
      if (!aiActions || aiActions.length === 0) {
        // No AI actions — apply final state immediately
        setGameState(finalResponse.game_state);
        setValidActions(finalResponse.valid_actions || []);
        setIsMyTurn(finalResponse.is_my_turn);
        setHandOver(finalResponse.hand_over);
        if (finalResponse.hand_results) setHandResults(finalResponse.hand_results);
        if (finalResponse.is_my_turn) setTurnKey((k) => k + 1);
        return;
      }

      setAnimating(true);
      setIsMyTurn(false);
      animatingRef.current = true;

      let i = 0;
      const playNext = () => {
        if (!animatingRef.current) return;
        if (i >= aiActions.length) {
          // All AI actions animated — apply final state
          setAnimating(false);
          animatingRef.current = false;
          setGameState(finalResponse.game_state);
          setValidActions(finalResponse.valid_actions || []);
          setIsMyTurn(finalResponse.is_my_turn);
          setHandOver(finalResponse.hand_over);
          if (finalResponse.hand_results) setHandResults(finalResponse.hand_results);
          if (finalResponse.is_my_turn) setTurnKey((k) => k + 1);
          return;
        }

        const action = aiActions[i];
        // Show this AI's action: update current_player_idx and last_action
        setGameState((prev) => {
          if (!prev) return prev;
          const newPlayers = prev.players.map((p) => {
            if (p.id === action.player_id) {
              return {
                ...p,
                last_action: { type: action.type, amount: action.amount },
                status: action.type === "fold" ? "folded" as const : action.type === "all_in" ? "all_in" as const : p.status,
              };
            }
            return p;
          });
          return {
            ...prev,
            players: newPlayers,
            current_player_idx: action.player_id,
          };
        });

        i++;
        setTimeout(playNext, AI_ACTION_DELAY);
      };

      // Start first action with a small delay
      setTimeout(playNext, 300);
    },
    []
  );

  const handleCreateGame = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await createGame({
        numOpponents,
        startingStack: 10000,
        smallBlind: 10,
        bigBlind: 20,
        difficulty,
      });
      setGameId(res.game_id);
      animateAIActions(res.ai_actions || [], res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  }, [numOpponents, difficulty, animateAIActions]);

  const handleAction = useCallback(
    async (actionType: string, amount?: number) => {
      if (!gameId || animating) return;
      setError("");
      setIsMyTurn(false); // Immediately disable turn
      try {
        const res = await sendAction(gameId, actionType, amount || 0);
        animateAIActions(res.ai_actions || [], res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        setIsMyTurn(true); // Restore on error
      }
    },
    [gameId, animating, animateAIActions]
  );

  const handleNewHand = useCallback(async () => {
    if (!gameId) return;
    setError("");
    setHandResults([]);
    setHandOver(false);
    try {
      const res = await startNewHand(gameId);
      animateAIActions(res.ai_actions || [], res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start new hand");
    }
  }, [gameId, animateAIActions]);

  const toggleDisplay = useCallback(() => {
    setDisplayMode((m) => (m === "won" ? "bb" : "won"));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      <nav className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
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

      <main className="px-2 md:px-4 pb-6">
        {!gameState ? (
          /* Lobby */
          <div className="flex flex-col items-center pt-12 md:pt-20 gap-8 max-w-sm mx-auto">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                {t("play.title")}
              </h1>
              <p className="text-xs text-[#555] mt-2">
                {t("play.configure")}
              </p>
            </div>

            <div className="flex flex-col gap-5 w-full">
              {/* Opponents */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
                    {t("play.opponents")}
                  </label>
                  <span className="text-xs text-white font-mono">{numOpponents}</span>
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
                <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">
                  {t("play.difficulty")}
                </label>
                <div className="flex gap-2">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-all border ${
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

              {/* Tournament info */}
              <div className="text-[10px] text-[#555] border border-[#222] bg-[#111] p-3">
                <span className="text-[#fbbf24] font-bold">TOURNAMENT MODE</span>
                <br />
                Starting: 1만 (10,000) · Blinds: 10/20 → auto increase
              </div>

              {/* Start */}
              <button
                onClick={handleCreateGame}
                disabled={loading}
                className="py-3 bg-white text-black font-semibold text-sm tracking-wider uppercase hover:bg-[#e5e5e5] disabled:bg-[#333] disabled:text-[#666] transition-all"
              >
                {loading ? t("play.creating") : t("play.startGame")}
              </button>
            </div>
          </div>
        ) : (
          /* Game table */
          <div className="flex flex-col items-center gap-3 pt-2">
            <PokerTable
              gameState={gameState}
              validActions={validActions}
              isMyTurn={isMyTurn && !animating}
              onAction={handleAction}
              turnKey={turnKey}
              displayMode={displayMode}
              onToggleDisplay={toggleDisplay}
            />

            {/* Hand results */}
            {handOver && handResults.length > 0 && (
              <div className="flex flex-col items-center gap-2 p-4 bg-[#111] border border-[#222] max-w-md w-full">
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
                      +{formatChips(r.pot_amount, displayMode, gameState.big_blind || 20)}
                    </span>
                    <span className="text-[#666] ml-1">
                      → {r.winners
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
                  className="mt-2 px-8 py-2 bg-white text-black font-medium text-xs tracking-wider uppercase hover:bg-[#e5e5e5] transition-all"
                >
                  {t("play.nextHand")}
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-[#1a0000] border border-[#441111] text-[#ff4444] text-center text-xs max-w-md mx-auto">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
