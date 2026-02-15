'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProfileHeader from './components/ProfileHeader'
import WorkExperience from './components/WorkExperience'
import Education from './components/Education'
import Skills from './components/Skills'

export default function ResumePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUser(session.user)
      }
      setLoading(false)
    }
    getUser()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Please log in to view your resume.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          NEXUS
        </a>
        <nav className="flex items-center gap-6">
          <a href="/resume" className="text-blue-400 font-medium">Resume</a>
          <a href="/contacts" className="text-gray-400 hover:text-white transition-colors">Contacts</a>
          <a href="/network" className="text-gray-400 hover:text-white transition-colors">Network</a>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <ProfileHeader userId={user.id} />
        <WorkExperience userId={user.id} />
        <Education userId={user.id} />
        <Skills userId={user.id} />
      </main>
    </div>
  )
}
