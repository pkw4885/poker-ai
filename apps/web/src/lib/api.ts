const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CreateGameParams {
  numOpponents: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  difficulty: string;
}

export async function createGame(params: CreateGameParams) {
  const res = await fetch(`${API_BASE}/api/game/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      num_opponents: params.numOpponents,
      starting_stack: params.startingStack,
      small_blind: params.smallBlind,
      big_blind: params.bigBlind,
      difficulty: params.difficulty,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendAction(
  gameId: string,
  actionType: string,
  amount: number = 0
) {
  const res = await fetch(`${API_BASE}/api/game/${gameId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action_type: actionType, amount }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function startNewHand(gameId: string) {
  const res = await fetch(`${API_BASE}/api/game/${gameId}/new-hand`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGameState(gameId: string) {
  const res = await fetch(`${API_BASE}/api/game/${gameId}/state`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
