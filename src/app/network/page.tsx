'use client';

import { useRouter } from 'next/navigation';

export default function NetworkPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition"
          >
            ← Dashboard
          </button>
          <h1 className="text-2xl font-bold">Network Graph</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-6">🕸️</div>
        <h2 className="text-xl font-bold mb-3">Network Visualization</h2>
        <p className="text-gray-400 max-w-md mx-auto mb-8">
          An interactive force-directed graph showing your contacts and how they connect to each other. 
          This will be built once you have contacts in the system.
        </p>
        <button
          onClick={() => router.push('/contacts')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
        >
          Go to Contacts →
        </button>
      </div>
    </div>
  );
}
