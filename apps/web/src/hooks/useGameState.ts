"use client";

import { create } from "zustand";
import type {
  GameStateView,
  ValidAction,
  HandResult,
  GameConfig,
  GamePhase,
} from "@/types/game";

interface GameStore {
  // Connection
  connected: boolean;
  gameId: string | null;

  // Game configuration
  config: GameConfig;

  // Game state
  gameState: GameStateView | null;
  validActions: ValidAction[];
  handResults: HandResult[];
  isMyTurn: boolean;
  myPlayerId: number;

  // UI state
  showResults: boolean;
  message: string;

  // Actions
  setConnected: (connected: boolean) => void;
  setGameId: (id: string | null) => void;
  setConfig: (config: Partial<GameConfig>) => void;
  updateGameState: (state: GameStateView) => void;
  setValidActions: (actions: ValidAction[]) => void;
  setHandResults: (results: HandResult[]) => void;
  setShowResults: (show: boolean) => void;
  setMessage: (msg: string) => void;
  reset: () => void;
}

const DEFAULT_CONFIG: GameConfig = {
  numOpponents: 3,
  startingStack: 1000,
  smallBlind: 5,
  bigBlind: 10,
};

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  gameId: null,
  config: DEFAULT_CONFIG,
  gameState: null,
  validActions: [],
  handResults: [],
  isMyTurn: false,
  myPlayerId: 0,
  showResults: false,
  message: "",

  setConnected: (connected) => set({ connected }),
  setGameId: (gameId) => set({ gameId }),
  setConfig: (config) =>
    set((state) => ({ config: { ...state.config, ...config } })),
  updateGameState: (gameState) =>
    set({
      gameState,
      isMyTurn: gameState.current_player_idx === 0 && isBettingPhase(gameState.phase),
    }),
  setValidActions: (validActions) => set({ validActions }),
  setHandResults: (handResults) => set({ handResults, showResults: true }),
  setShowResults: (showResults) => set({ showResults }),
  setMessage: (message) => set({ message }),
  reset: () =>
    set({
      gameState: null,
      validActions: [],
      handResults: [],
      isMyTurn: false,
      showResults: false,
      message: "",
      gameId: null,
    }),
}));

function isBettingPhase(phase: GamePhase): boolean {
  return ["preflop_bet", "flop_bet", "turn_bet", "river_bet"].includes(phase);
}
