'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
    }
    getUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#fff' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', borderBottom: '1px solid #333' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#c9a227' }}>NEXUS</h1>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: activeTab === 'home' ? '#c9a227' : '#fff', cursor: 'pointer', fontSize: '16px' }}>Home</button>
          <button onClick={() => setActiveTab('resume')} style={{ background: 'none', border: 'none', color: activeTab === 'resume' ? '#c9a227' : '#fff', cursor: 'pointer', fontSize: '16px' }}>Resume</button>
          <button onClick={() => setActiveTab('contacts')} style={{ background: 'none', border: 'none', color: activeTab === 'contacts' ? '#c9a227' : '#fff', cursor: 'pointer', fontSize: '16px' }}>Contacts</button>
          <button onClick={() => setActiveTab('network')} style={{ background: 'none', border: 'none', color: activeTab === 'network' ? '#c9a227' : '#fff', cursor: 'pointer', fontSize: '16px' }}>Network</button>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #c9a227', color: '#c9a227', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
        </div>
      </nav>

      <main style={{ padding: '40px' }}>
        {activeTab === 'home' && (
          <div>
            <h2 style={{ fontSize: '28px', marginBottom: '10px' }}>Welcome back!</h2>
            <p style={{ color: '#aaa', marginBottom: '40px' }}>{user.email}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div onClick={() => setActiveTab('resume')} style={{ border: '1px solid #333', borderRadius: '8px', padding: '30px', cursor: 'pointer', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = '#c9a227')} onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}>
                <h3 style={{ fontSize: '20px', color: '#c9a227', marginBottom: '10px' }}>Smart Resume</h3>
                <p style={{ color: '#aaa' }}>Build and manage your professional profile</p>
              </div>
              <div onClick={() => setActiveTab('contacts')} style={{ border: '1px solid #333', borderRadius: '8px', padding: '30px', cursor: 'pointer', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = '#c9a227')} onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}>
                <h3 style={{ fontSize: '20px', color: '#c9a227', marginBottom: '10px' }}>Contact CRM</h3>
                <p style={{ color: '#aaa' }}>Manage your professional relationships</p>
              </div>
              <div onClick={() => setActiveTab('network')} style={{ border: '1px solid #333', borderRadius: '8px', padding: '30px', cursor: 'pointer', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = '#c9a227')} onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}>
                <h3 style={{ fontSize: '20px', color: '#c9a227', marginBottom: '10px' }}>Network Graph</h3>
                <p style={{ color: '#aaa' }}>Visualize your professional network</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resume' && (
          <div>
            <h2 style={{ fontSize: '28px', marginBottom: '20px' }}>Smart Resume</h2>
            <p style={{ color: '#aaa', marginBottom: '30px' }}>Your professional profile and work history</p>
            <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '30px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', color: '#c9a227', marginBottom: '15px' }}>Profile</h3>
              <p style={{ color: '#aaa' }}>Name, headline, and location coming soon...</p>
            </div>
            <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '30px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', color: '#c9a227', marginBottom: '15px' }}>Work Experience</h3>
              <p style={{ color: '#aaa' }}>Add your work history here...</p>
            </div>
            <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '30px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', color: '#c9a227', marginBottom: '15px' }}>Education</h3>
              <p style={{ color: '#aaa' }}>Add your education here...</p>
            </div>
            <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '30px' }}>
              <h3 style={{ fontSize: '20px', color: '#c9a227', marginBottom: '15px' }}>Skills</h3>
              <p style={{ color: '#aaa' }}>Add your skills here...</p>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div>
            <h2 style={{ fontSize: '28px', marginBottom: '20px' }}>Contact CRM</h2>
            <p style={{ color: '#aaa' }}>Manage your professional relationships. Full CRM coming soon.</p>
          </div>
        )}

        {activeTab === 'network' && (
          <div>
            <h2 style={{ fontSize: '28px', marginBottom: '20px' }}>Network Graph</h2>
            <p style={{ color: '#aaa' }}>Interactive network visualization coming soon.</p>
          </div>
        )}
      </main>
    </div>
  )
}
