export type ActionType = "fold" | "check" | "call" | "raise" | "all_in";

export type PlayerStatus = "active" | "folded" | "all_in" | "out";

export type GamePhase =
  | "waiting"
  | "deal_hole"
  | "preflop_bet"
  | "deal_flop"
  | "flop_bet"
  | "deal_turn"
  | "turn_bet"
  | "deal_river"
  | "river_bet"
  | "showdown"
  | "hand_over";

export interface LastAction {
  type: ActionType;
  amount?: number;
}

export interface PlayerView {
  id: number;
  name: string;
  stack: number;
  status: PlayerStatus;
  current_bet: number;
  total_bet: number;
  hole_cards: number[];
  last_action?: LastAction | null;
}

export interface PotInfo {
  name: string;
  amount: number;
  eligible_players: number[];
}

export interface GameStateView {
  players: PlayerView[];
  board: number[];
  phase: GamePhase;
  street: number;
  pots: PotInfo[];
  total_pot: number;
  dealer_pos: number;
  small_blind_pos: number;
  big_blind_pos: number;
  small_blind: number;
  big_blind: number;
  current_player_idx: number;
  hand_number: number;
}

export interface AIAction {
  player_id: number;
  type: ActionType;
  amount: number;
}

export interface ValidAction {
  type: ActionType;
  amount?: number;
  min_amount?: number;
  max_amount?: number;
}

export interface HandResult {
  pot_amount: number;
  winners: number[];
  hand_class: string;
}

export interface ServerMessage {
  type: string;
  data?: unknown;
  game_state?: GameStateView;
  valid_actions?: ValidAction[];
  hand_results?: HandResult[];
  error?: string;
}

export interface GameConfig {
  numOpponents: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
}

// Card display utilities
export const RANK_MAP: Record<string, string> = {
  "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
  "7": "7", "8": "8", "9": "9", "T": "10", "J": "J",
  "Q": "Q", "K": "K", "A": "A",
};

export const SUIT_SYMBOLS: Record<string, string> = {
  s: "\u2660", // ♠
  h: "\u2665", // ♥
  d: "\u2666", // ♦
  c: "\u2663", // ♣
};

export const SUIT_COLORS: Record<string, string> = {
  s: "text-gray-900 dark:text-white",
  h: "text-red-600",
  d: "text-blue-600",
  c: "text-green-700",
};
