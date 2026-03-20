"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function AuthPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        await register(username, email, password);
      } else {
        await login(email, password);
      }
      router.push("/rooms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <Link
          href="/"
          className="text-xs text-[#666] hover:text-white transition-colors uppercase tracking-wider"
        >
          &larr; Back
        </Link>
        <span className="text-xs font-semibold tracking-widest uppercase text-[#444]">
          {mode === "login" ? "Login" : "Register"}
        </span>
        <div className="w-12" />
      </nav>

      <main className="flex-1 flex items-center justify-center px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm flex flex-col gap-5"
        >
          <h1 className="text-2xl font-bold text-white text-center tracking-tight">
            {mode === "login" ? "Login" : "Create Account"}
          </h1>

          {/* Tab toggle */}
          <div className="flex border border-[#222]">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 text-xs font-medium tracking-wider uppercase transition-all ${
                mode === "login"
                  ? "bg-white text-black"
                  : "bg-transparent text-[#666] hover:text-[#999]"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 py-2.5 text-xs font-medium tracking-wider uppercase transition-all ${
                mode === "register"
                  ? "bg-white text-black"
                  : "bg-transparent text-[#666] hover:text-[#999]"
              }`}
            >
              Register
            </button>
          </div>

          {mode === "register" && (
            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={2}
                maxLength={20}
                className="w-full px-4 py-3 bg-[#111] border border-[#222] text-white text-sm focus:border-[#555] focus:outline-none transition-colors"
                placeholder="username"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#111] border border-[#222] text-white text-sm focus:border-[#555] focus:outline-none transition-colors"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-[#111] border border-[#222] text-white text-sm focus:border-[#555] focus:outline-none transition-colors"
              placeholder="••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-[#1a0000] border border-[#441111] text-[#ff4444] text-xs text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="py-3 bg-white text-black font-semibold text-sm tracking-wider uppercase hover:bg-[#e5e5e5] disabled:bg-[#333] disabled:text-[#666] transition-all"
          >
            {loading
              ? "..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </form>
      </main>
    </div>
  );
}
