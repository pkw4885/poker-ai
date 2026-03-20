import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <main className="flex flex-col items-center justify-center min-h-screen px-6">
        <h1 className="text-5xl font-bold mb-4 tracking-tight">
          Poker AI
        </h1>
        <p className="text-xl text-gray-400 mb-12 text-center max-w-lg">
          Texas Hold&apos;em AI System — WSOP Rules, GTO+
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          <Link
            href="/guide"
            className="group flex flex-col items-center p-8 bg-gray-800/50 border border-gray-700 rounded-2xl hover:border-emerald-500 hover:bg-gray-800 transition-all"
          >
            <div className="text-4xl mb-4">&#9824;</div>
            <h2 className="text-xl font-semibold mb-2 group-hover:text-emerald-400 transition-colors">
              Poker Guide
            </h2>
            <p className="text-gray-400 text-center text-sm">
              Situation-based optimal action recommendations
            </p>
          </Link>

          <Link
            href="/play"
            className="group flex flex-col items-center p-8 bg-gray-800/50 border border-gray-700 rounded-2xl hover:border-blue-500 hover:bg-gray-800 transition-all"
          >
            <div className="text-4xl mb-4">&#9830;</div>
            <h2 className="text-xl font-semibold mb-2 group-hover:text-blue-400 transition-colors">
              Play vs AI
            </h2>
            <p className="text-gray-400 text-center text-sm">
              Play against 1~7 AI opponents
            </p>
          </Link>

          <div className="group flex flex-col items-center p-8 bg-gray-800/50 border border-gray-700 rounded-2xl opacity-60 cursor-not-allowed">
            <div className="text-4xl mb-4">&#9829;</div>
            <h2 className="text-xl font-semibold mb-2">
              ParkPoker
            </h2>
            <p className="text-gray-400 text-center text-sm">
              Elite AI 1v1 — Coming Soon
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
