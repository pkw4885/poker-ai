"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getRoom,
  leaveRoom,
  startRoomGame,
  createRoomWebSocket,
  type RoomDetail,
} from "@/lib/rooms";
import PokerTable from "@/components/table/PokerTable";
import TurnTimer from "@/components/table/TurnTimer";
import type { GameStateView, ValidAction, HandResult } from "@/types/game";

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = Number(params.id);
  const { user, token } = useAuth();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [error, setError] = useState("");

  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<GameStateView | null>(null);
  const [validActions, setValidActions] = useState<ValidAction[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [handOver, setHandOver] = useState(false);
  const [handResults, setHandResults] = useState<HandResult[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch room details
  useEffect(() => {
    getRoom(roomId).then(setRoom).catch(() => setError("Room not found"));
  }, [roomId]);

  // WebSocket connection
  useEffect(() => {
    if (!token || !roomId) return;

    const ws = createRoomWebSocket(roomId, token);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "player_joined":
        case "player_left":
          if (msg.room) setRoom(msg.room);
          break;
        case "game_started":
          setGameStarted(true);
          if (msg.game_state) {
            setGameState(msg.game_state);
            setValidActions(msg.valid_actions || []);
            setIsMyTurn(msg.is_my_turn || false);
            setHandOver(false);
            setHandResults([]);
          }
          break;
        case "game_state_update":
          if (msg.game_state) setGameState(msg.game_state);
          setValidActions(msg.valid_actions || []);
          setIsMyTurn(msg.is_my_turn || false);
          setHandOver(msg.hand_over || false);
          if (msg.hand_results) setHandResults(msg.hand_results);
          break;
        case "your_turn":
          setValidActions(msg.valid_actions || []);
          setIsMyTurn(true);
          break;
        case "hand_over":
          setHandOver(true);
          if (msg.hand_results) setHandResults(msg.hand_results);
          if (msg.game_state) setGameState(msg.game_state);
          break;
        case "error":
          setError(msg.message || "Unknown error");
          break;
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
    };
  }, [token, roomId]);

  const handleAction = useCallback(
    (actionType: string, amount?: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: "player_action",
          action_type: actionType,
          amount: amount || 0,
        })
      );
      setIsMyTurn(false);
    },
    []
  );

  const handleLeave = async () => {
    if (token) {
      try {
        await leaveRoom(token, roomId);
      } catch {
        // ignore
      }
    }
    router.push("/rooms");
  };

  const handleStart = async () => {
    if (!token) return;
    try {
      await startRoomGame(token, roomId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    }
  };

  const handleNewHand = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "new_hand" }));
    setHandOver(false);
    setHandResults([]);
  };

  const isHost = room && user && room.host_username === user.username;

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <span className="text-[#444] text-xs tracking-wider">
          {error || "Loading..."}
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <button
          onClick={handleLeave}
          className="text-xs text-[#666] hover:text-white transition-colors uppercase tracking-wider"
        >
          &larr; Leave
        </button>
        <span className="text-xs font-semibold tracking-widest uppercase text-[#444]">
          {room.name}
        </span>
        <span className="text-[10px] text-[#555]">
          {room.player_count}/{room.max_players}
        </span>
      </nav>

      <main className="px-4 pb-8">
        {!gameStarted ? (
          /* Waiting room */
          <div className="max-w-md mx-auto pt-12 flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-xl font-bold text-white tracking-tight mb-1">
                {room.name}
              </h1>
              <p className="text-[10px] text-[#555] tracking-wider uppercase">
                Waiting for players
              </p>
            </div>

            {/* Room info */}
            <div className="border border-[#222] bg-[#111] p-4 flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#555]">Host</span>
                <span className="text-white">{room.host_username}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#555]">Max Players</span>
                <span className="text-white">{room.max_players}</span>
              </div>
              {room.ai_count > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#555]">AI Players</span>
                    <span className="text-white">{room.ai_count}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#555]">AI Difficulty</span>
                    <span className="text-white uppercase">{room.ai_difficulty}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#555]">AI Muck Mode</span>
                    <span className="text-white">
                      {room.ai_muck ? "먹 허용" : "공개"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#555]">AI Fold Reveal</span>
                    <span className="text-white">
                      {room.ai_fold_reveal ? "공개" : "비공개"}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Players list */}
            <div className="border border-[#222] bg-[#111] p-4">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-3 block">
                Players ({room.players.length})
              </span>
              <div className="flex flex-col gap-2">
                {room.players.map((p, i) => (
                  <div
                    key={p.user_id}
                    className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#444] font-mono w-4">
                        {i + 1}
                      </span>
                      <span className="text-sm text-white">{p.username}</span>
                    </div>
                    {p.username === room.host_username && (
                      <span className="text-[10px] text-[#fbbf24] tracking-wider uppercase">
                        Host
                      </span>
                    )}
                  </div>
                ))}
                {room.ai_count > 0 &&
                  Array.from({ length: room.ai_count }, (_, i) => (
                    <div
                      key={`ai-${i}`}
                      className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#444] font-mono w-4">
                          {room.players.length + i + 1}
                        </span>
                        <span className="text-sm text-[#666]">
                          AI_{i + 1} ({room.ai_difficulty})
                        </span>
                      </div>
                      <span className="text-[10px] text-[#555] tracking-wider uppercase">
                        Bot
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Start button (host only) */}
            {isHost && (
              <button
                onClick={handleStart}
                className="py-3 bg-white text-black font-semibold text-sm tracking-wider uppercase hover:bg-[#e5e5e5] transition-all"
              >
                Start Game
              </button>
            )}

            {!isHost && (
              <div className="text-center text-[10px] text-[#444] tracking-wider uppercase animate-pulse">
                Waiting for host to start
              </div>
            )}
          </div>
        ) : gameState ? (
          /* Game in progress */
          <div className="flex flex-col items-center gap-4 pt-4">
            <PokerTable
              gameState={gameState}
              validActions={validActions}
              isMyTurn={isMyTurn}
              onAction={handleAction}
              turnDuration={30}
            />

            {handOver && handResults.length > 0 && (
              <div className="flex flex-col items-center gap-3 p-5 bg-[#111] border border-[#222] max-w-md w-full">
                <span className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
                  Hand Result
                </span>
                {handResults.map((r, i) => (
                  <div key={i} className="text-sm text-center">
                    <span className="text-[#999]">
                      {r.hand_class === "fold" ? "Won by fold" : r.hand_class}
                    </span>
                    <span className="text-[#00dc82] ml-2 font-mono">
                      +{r.pot_amount}
                    </span>
                  </div>
                ))}
                {isHost && (
                  <button
                    onClick={handleNewHand}
                    className="mt-2 px-8 py-2.5 bg-white text-black font-medium text-xs tracking-wider uppercase hover:bg-[#e5e5e5] transition-all"
                  >
                    Next Hand
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center pt-20">
            <span className="text-[#444] text-xs tracking-wider animate-pulse">
              Starting game...
            </span>
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
