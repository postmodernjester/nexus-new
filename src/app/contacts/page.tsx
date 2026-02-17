'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createInvite } from '@/lib/connections';

interface Contact {
  id: string;
  owner_id: string;
  full_name: string;
  email: string | null;
  company: string | null;
  role: string | null;
  location: string | null;
  relationship_type: string | null;
  avatar_url: string | null;
  how_we_met: string | null;
  created_at: string;
}

const RELATIONSHIP_TYPES = ['All', 'Family', 'Close Friend', 'Business Contact', 'Acquaintance', 'Stranger'];

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Acquaintance');
  const [newEmail, setNewEmail] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newHowWeMet, setNewHowWeMet] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Invite state
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteContactName, setInviteContactName] = useState('');
  const [inviteLoading, setInviteLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  async function fetchContacts() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data, error } = await supabase.from('contacts').select('*').eq('owner_id', user.id).order('full_name', { ascending: true });
    if (!error) setContacts(data || []);
    setLoading(false);
  }

  async function handleAddContact() {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error: insertError } = await supabase.from('contacts').insert({
      owner_id: user.id,
      full_name: newName.trim(),
      relationship_type: newType,
      email: newEmail.trim() || null,
      company: newCompany.trim() || null,
      role: newRole.trim() || null,
      how_we_met: newHowWeMet.trim() || null,
    }).select().single();
    if (insertError) {
      setError('Failed to add contact: ' + insertError.message);
    } else if (data) {
      setContacts([...contacts, data]);
      setShowAddModal(false);
      setNewName(''); setNewType('Acquaintance'); setNewEmail('');
      setNewCompany(''); setNewRole(''); setNewHowWeMet('');
    }
    setSaving(false);
  }

  async function handleInvite(e: React.MouseEvent, contact: Contact) {
    e.stopPropagation();
    setInviteLoading(contact.id);
    const { code, error } = await createInvite(contact.id);
    setInviteLoading(null);
    if (code) {
      setInviteCode(code);
      setInviteContactName(contact.full_name);
      setCopied(false);
    } else {
      setError(error || 'Failed to generate invite');
    }
  }

  async function copyCode() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = (c.full_name + ' ' + (c.company || '') + ' ' + (c.role || '')).toLowerCase().includes(q);
    const matchesType = filterType === 'All' || c.relationship_type === filterType;
    return matchesSearch && matchesType;
  });

  function initials(name: string) { const p = name.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase(); }

  function typeColor(type: string | null) {
    const c: Record<string, string> = {
      'Family': 'bg-purple-600',
      'Close Friend': 'bg-pink-600',
      'Business Contact': 'bg-blue-600',
      'Acquaintance': 'bg-teal-600',
      'Stranger': 'bg-gray-600',
    };
    return c[type || ''] || 'bg-gray-600';
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition">← Dashboard</button>
            <h1 className="text-2xl font-bold">Contacts</h1>
            <span className="text-gray-500 text-sm">{filtered.length} {filtered.length === 1 ? 'contact' : 'contacts'}</span>
          </div>
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition">+ Add Contact</button>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <div className="flex gap-2 flex-wrap">
            {RELATIONSHIP_TYPES.map((type) => (
              <button key={type} onClick={() => setFilterType(type)} className={'px-3 py-1.5 rounded-full text-sm font-medium transition ' + (filterType === type ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>{type}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading contacts...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 text-lg mb-2">{contacts.length === 0 ? 'No contacts yet' : 'No contacts match your search'}</div>
            {contacts.length === 0 && <p className="text-gray-600 text-sm">Click &quot;+ Add Contact&quot; to start building your network.</p>}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((contact) => (
              <div key={contact.id} onClick={() => router.push('/contacts/' + contact.id)} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-4 cursor-pointer hover:border-gray-600 transition group">
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300 shrink-0">{initials(contact.full_name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{contact.full_name}</span>
                    {contact.relationship_type && <span className={'text-xs px-2 py-0.5 rounded-full text-white ' + typeColor(contact.relationship_type)}>{contact.relationship_type}</span>}
                  </div>
                  <div className="text-gray-400 text-sm truncate">{[contact.role, contact.company].filter(Boolean).join(' at ') || 'No details yet'}</div>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-gray-500 text-sm">
                  {contact.email && <span>✉ {contact.email}</span>}
                </div>
                <button
                  onClick={(e) => handleInvite(e, contact)}
                  disabled={inviteLoading === contact.id}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-lg text-sm font-medium transition border border-amber-500/20 hover:border-amber-500/40 disabled:opacity-50"
                >
                  {inviteLoading === contact.id ? '...' : '🔗 Invite'}
                </button>
                <div className="text-gray-600 group-hover:text-gray-400 transition">→</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Code Modal */}
      {inviteCode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🔗</div>
            <h2 className="text-xl font-bold mb-1">Invite {inviteContactName}</h2>
            <p className="text-gray-400 text-sm mb-6">Share this code with them. They&apos;ll enter it when they sign up for NEXUS.</p>
            <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 mb-4 flex items-center justify-center gap-3">
              <span className="text-2xl font-mono font-bold tracking-wider text-amber-400">{inviteCode}</span>
            </div>
            <button
              onClick={copyCode}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2.5 rounded-lg transition mb-3"
            >
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
            <button
              onClick={() => { setInviteCode(null); setInviteContactName(''); }}
              className="w-full text-gray-400 hover:text-white py-2 transition text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Add Contact</h2>
              <button onClick={() => { setShowAddModal(false); setError(''); }} className="text-gray-500 hover:text-white text-2xl">×</button>
            </div>
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-2 mb-4 text-red-300 text-sm">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Relationship</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500">
                  {RELATIONSHIP_TYPES.filter((t) => t !== 'All').map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email <span className="text-gray-600">(optional)</span></label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Company <span className="text-gray-600">(optional)</span></label>
                  <input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role <span className="text-gray-600">(optional)</span></label>
                  <input type="text" value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">How you met <span className="text-gray-600">(optional)</span></label>
                <input type="text" value={newHowWeMet} onChange={(e) => setNewHowWeMet(e.target.value)} placeholder="e.g. Conference, mutual friend..." className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
              </div>
              <button onClick={handleAddContact} disabled={saving || !newName.trim()} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition">
                {saving ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
