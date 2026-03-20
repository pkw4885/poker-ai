/**
 * Card display utilities.
 *
 * Treys encodes cards as 32-bit integers. We decode them for display.
 * Format: xxxbbbbb_bbbbbbbb_cdhsrrrr_xxpppppp
 *   - bits 12-15: suit (one-hot: clubs=8, diamonds=4, hearts=2, spades=1)
 *   - bits 16-28: prime rank
 *   - bits 8-11: rank (0=2 ... 12=A)
 */

const RANK_CHARS = "23456789TJQKA";
const SUIT_CHARS = "xshxdxxxc"; // indexed by bit position of one-hot suit

const SUIT_SYMBOLS: Record<string, string> = {
  s: "\u2660",
  h: "\u2665",
  d: "\u2666",
  c: "\u2663",
};

const SUIT_COLORS: Record<string, string> = {
  s: "#1a1a2e",
  h: "#dc2626",
  d: "#2563eb",
  c: "#15803d",
};

export function decodeCard(cardInt: number): { rank: string; suit: string } {
  const rankBits = (cardInt >> 8) & 0xf;
  const suitBits = (cardInt >> 12) & 0xf;

  const rank = RANK_CHARS[rankBits] || "?";

  let suit = "?";
  if (suitBits & 1) suit = "s";
  else if (suitBits & 2) suit = "h";
  else if (suitBits & 4) suit = "d";
  else if (suitBits & 8) suit = "c";

  return { rank, suit };
}

export function cardDisplay(cardInt: number): string {
  const { rank, suit } = decodeCard(cardInt);
  const display = rank === "T" ? "10" : rank;
  return `${display}${SUIT_SYMBOLS[suit] || suit}`;
}

export function getSuitSymbol(suit: string): string {
  return SUIT_SYMBOLS[suit] || suit;
}

export function getSuitColor(suit: string): string {
  return SUIT_COLORS[suit] || "#000";
}

export function isRedSuit(suit: string): boolean {
  return suit === "h" || suit === "d";
}
