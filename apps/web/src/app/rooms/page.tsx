"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { listRooms, createRoom, joinRoom, type Room } from "@/lib/rooms";

type Difficulty = "easy" | "medium" | "hard";

export default function RoomsPage() {
  const router = useRouter();
  const { user, token, loading: authLoading, logout } = useAuth();
  const { t } = useI18n();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create room form
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [aiCount, setAiCount] = useState(2);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const [aiMuck, setAiMuck] = useState(false);
  const [aiFoldReveal, setAiFoldReveal] = useState(true);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await listRooms();
      setRooms(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
      return;
    }
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [authLoading, user, router, fetchRooms]);

  const handleCreate = async () => {
    if (!token || !roomName.trim()) return;
    setError("");
    setLoading(true);
    try {
      const result = await createRoom(token, {
        name: roomName.trim(),
        max_players: maxPlayers,
        ai_count: aiCount,
        ai_difficulty: aiDifficulty,
        ai_muck: aiMuck,
        ai_fold_reveal: aiFoldReveal,
      });
      router.push(`/rooms/${result.room_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (roomId: number) => {
    if (!token) return;
    setError("");
    try {
      await joinRoom(token, roomId);
      router.push(`/rooms/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join room");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <span className="text-[#444] text-xs tracking-wider">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <Link
          href="/"
          className="text-xs text-[#666] hover:text-white transition-colors uppercase tracking-wider"
        >
          &larr; {t("common.back")}
        </Link>
        <span className="text-xs font-semibold tracking-widest uppercase text-[#444]">
          {t("nav.rooms")}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#666]">{user?.username}</span>
          <button
            onClick={logout}
            className="text-[10px] text-[#555] hover:text-[#ff4444] transition-colors uppercase tracking-wider"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Create room toggle */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Game Rooms
          </h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 text-xs font-medium tracking-wider uppercase bg-white text-black hover:bg-[#e5e5e5] transition-all"
          >
            {showCreate ? "Cancel" : "Create Room"}
          </button>
        </div>

        {/* Create room form */}
        {showCreate && (
          <div className="border border-[#222] bg-[#111] p-5 mb-6 flex flex-col gap-4">
            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={30}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#222] text-white text-sm focus:border-[#555] focus:outline-none transition-colors"
                placeholder="My Poker Room"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
                    Max Players
                  </label>
                  <span className="text-xs text-white font-mono">{maxPlayers}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={8}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
                    AI Players
                  </label>
                  <span className="text-xs text-white font-mono">{aiCount}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={7}
                  value={aiCount}
                  onChange={(e) => setAiCount(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">
                AI Difficulty
              </label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setAiDifficulty(d)}
                    className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-all border ${
                      aiDifficulty === d
                        ? "bg-white text-black border-white"
                        : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">
                AI Muck Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAiMuck(false)}
                  className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-all border ${
                    !aiMuck
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                  }`}
                >
                  Never Muck (공개)
                </button>
                <button
                  onClick={() => setAiMuck(true)}
                  className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-all border ${
                    aiMuck
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                  }`}
                >
                  Can Muck (먹 허용)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">
                AI Fold Reveal
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAiFoldReveal(true)}
                  className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-all border ${
                    aiFoldReveal
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                  }`}
                >
                  Show Cards (공개)
                </button>
                <button
                  onClick={() => setAiFoldReveal(false)}
                  className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-all border ${
                    !aiFoldReveal
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-[#666] border-[#333] hover:border-[#555]"
                  }`}
                >
                  Hide Cards (비공개)
                </button>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !roomName.trim()}
              className="py-3 bg-white text-black font-semibold text-sm tracking-wider uppercase hover:bg-[#e5e5e5] disabled:bg-[#333] disabled:text-[#666] transition-all"
            >
              {loading ? "Creating..." : "Create Room"}
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-[#1a0000] border border-[#441111] text-[#ff4444] text-xs text-center mb-4">
            {error}
          </div>
        )}

        {/* Room list */}
        <div className="flex flex-col gap-2">
          {rooms.length === 0 && (
            <div className="text-center py-12 text-[#444] text-xs tracking-wider">
              No active rooms. Create one to start playing.
            </div>
          )}
          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between p-4 border border-[#222] bg-[#111] hover:border-[#333] transition-all"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm text-white font-medium">
                  {room.name}
                </span>
                <div className="flex gap-3 text-[10px] text-[#555] tracking-wider uppercase">
                  <span>Host: {room.host_username}</span>
                  <span>
                    {room.player_count}/{room.max_players} Players
                  </span>
                  {room.ai_count > 0 && (
                    <span>
                      AI: {room.ai_count} ({room.ai_difficulty})
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleJoin(room.id)}
                className="px-4 py-2 text-xs font-medium tracking-wider uppercase border border-[#333] text-[#999] hover:border-white hover:text-white transition-all"
              >
                Join
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
