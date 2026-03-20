import Link from "next/link";

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <header className="p-6">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors">
          &larr; Back
        </Link>
      </header>
      <main className="flex flex-col items-center px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Poker Guide</h1>
        <p className="text-gray-400 text-center max-w-md">
          Select your situation to get optimal action recommendations.
          This feature will be powered by CFR-based AI analysis.
        </p>
        <div className="mt-12 p-8 bg-gray-800/50 border border-gray-700 rounded-2xl w-full max-w-2xl">
          <p className="text-center text-gray-500">
            Guide interface will be implemented in Phase 3
          </p>
        </div>
      </main>
    </div>
  );
}
