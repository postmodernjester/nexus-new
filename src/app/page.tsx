'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="nexus-heading text-6xl md:text-7xl">
          ZICK_NEX<span className="text-nexus-gold">US</span>
        </h1>
        <p className="text-nexus-lightgray text-lg md:text-xl leading-relaxed">
          A private, intelligent professional network tool and relationship manager.
          No ads. No feed. No noise.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/signup" className="nexus-button text-center">
            Get Started
          </Link>
          <Link href="/login" className="nexus-button-outline text-center">
            Sign In
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-6 pt-12 text-center">
          <div>
            <div className="text-nexus-gold text-2xl font-bold mb-1">Resume</div>
            <p className="text-nexus-gray text-sm">AI-powered smart resume with career analysis</p>
          </div>
          <div>
            <div className="text-nexus-gold text-2xl font-bold mb-1">CRM</div>
            <p className="text-nexus-gray text-sm">Private dossiers and relationship tracking</p>
          </div>
          <div>
            <div className="text-nexus-gold text-2xl font-bold mb-1">Graph</div>
            <p className="text-nexus-gray text-sm">Visual network of your professional world</p>
          </div>
        </div>
      </div>
    </main>
  )
}
