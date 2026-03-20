const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Room {
  id: number;
  name: string;
  host_username: string;
  max_players: number;
  ai_count: number;
  ai_difficulty: string;
  status: string;
  player_count: number;
  created_at: string;
}

export interface RoomDetail extends Room {
  players: { user_id: number; username: string; seat_index: number }[];
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function listRooms(): Promise<Room[]> {
  const res = await fetch(`${API_BASE}/api/rooms`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createRoom(
  token: string,
  data: {
    name: string;
    max_players: number;
    ai_count: number;
    ai_difficulty: string;
  }
): Promise<RoomDetail> {
  const res = await fetch(`${API_BASE}/api/rooms`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRoom(roomId: number): Promise<RoomDetail> {
  const res = await fetch(`${API_BASE}/api/rooms/${roomId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function joinRoom(
  token: string,
  roomId: number
): Promise<RoomDetail> {
  const res = await fetch(`${API_BASE}/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function leaveRoom(
  token: string,
  roomId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rooms/${roomId}/leave`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function startRoomGame(
  token: string,
  roomId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rooms/${roomId}/start`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await res.text());
}

export function createRoomWebSocket(
  roomId: number,
  token: string
): WebSocket {
  const wsBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    .replace("http://", "ws://")
    .replace("https://", "wss://");
  return new WebSocket(`${wsBase}/ws/room/${roomId}?token=${token}`);
}
