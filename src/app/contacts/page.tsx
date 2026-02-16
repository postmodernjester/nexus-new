'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Contact {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  relationship_type: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  created_at: string;
}

const RELATIONSHIP_TYPES = [
  'All',
  'Colleague',
  'Client',
  'Friend',
  'Mentor',
  'Mentee',
  'Collaborator',
  'Vendor',
  'Recruiter',
  'Other',
];

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    job_title: '',
    relationship_type: 'Colleague',
    linkedin_url: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('owner_id', user.id)
      .order('last_name', { ascending: true });

    if (error) {
      console.error('Error fetching contacts:', error);
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  }

  async function handleAddContact() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        owner_id: user.id,
        first_name: newContact.first_name,
        last_name: newContact.last_name,
        email: newContact.email || null,
        phone: newContact.phone || null,
        company: newContact.company || null,
        job_title: newContact.job_title || null,
        relationship_type: newContact.relationship_type || null,
        linkedin_url: newContact.linkedin_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding contact:', error);
      alert('Failed to add contact: ' + error.message);
    } else if (data) {
      setContacts([...contacts, data]);
      setShowAddModal(false);
      setNewContact({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
        job_title: '',
        relationship_type: 'Colleague',
        linkedin_url: '',
      });
    }
    setSaving(false);
  }

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      `${c.first_name} ${c.last_name} ${c.company || ''} ${c.job_title || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesType =
      filterType === 'All' || c.relationship_type === filterType;
    return matchesSearch && matchesType;
  });

  function getInitials(first: string, last: string) {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
  }

  function getTypeColor(type: string | null) {
    const colors: Record<string, string> = {
      Colleague: 'bg-blue-600',
      Client: 'bg-green-600',
      Friend: 'bg-purple-600',
      Mentor: 'bg-yellow-600',
      Mentee: 'bg-orange-600',
      Collaborator: 'bg-cyan-600',
      Vendor: 'bg-red-600',
      Recruiter: 'bg-pink-600',
      Other: 'bg-gray-600',
    };
    return colors[type || ''] || 'bg-gray-600';
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white transition"
            >
              ← Dashboard
            </button>
            <h1 className="text-2xl font-bold">Contacts</h1>
            <span className="text-gray-500 text-sm">
              {filtered.length} {filtered.length === 1 ? 'contact' : 'contacts'}
            </span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2 flex-wrap">
            {RELATIONSHIP_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  filterType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contact List */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading contacts...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 text-lg mb-2">
              {contacts.length === 0
                ? 'No contacts yet'
                : 'No contacts match your search'}
            </div>
            {contacts.length === 0 && (
              <p className="text-gray-600 text-sm">
                Click &quot;+ Add Contact&quot; to start building your network.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((contact) => (
              <div
                key={contact.id}
                onClick={() => router.push(`/contacts/${contact.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-4 cursor-pointer hover:border-gray-600 hover:bg-gray-850 transition group"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300 shrink-0">
                  {getInitials(contact.first_name, contact.last_name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {contact.first_name} {contact.last_name}
                    </span>
                    {contact.relationship_type && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full text-white ${getTypeColor(
                          contact.relationship_type
                        )}`}
                      >
                        {contact.relationship_type}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 text-sm truncate">
                    {[contact.job_title, contact.company]
                      .filter(Boolean)
                      .join(' at ') || 'No title or company'}
                  </div>
                </div>

                {/* Contact methods */}
                <div className="hidden sm:flex items-center gap-3 text-gray-500 text-sm">
                  {contact.email && <span>✉ {contact.email}</span>}
                  {contact.phone && <span>📱 {contact.phone}</span>}
                </div>

                {/* Arrow */}
                <div className="text-gray-600 group-hover:text-gray-400 transition">
                  →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Add Contact</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newContact.first_name}
                    onChange={(e) =>
                      setNewContact({ ...newContact, first_name: e.target.value })
                    }
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newContact.last_name}
                    onChange={(e) =>
                      setNewContact({ ...newContact, last_name: e.target.value })
                    }
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) =>
                    setNewContact({ ...newContact, email: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) =>
                    setNewContact({ ...newContact, phone: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={newContact.job_title}
                    onChange={(e) =>
                      setNewContact({ ...newContact, job_title: e.target.value })
                    }
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={newContact.company}
                    onChange={(e) =>
                      setNewContact({ ...newContact, company: e.target.value })
                    }
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Relationship Type
                </label>
                <select
                  value={newContact.relationship_type}
                  onChange={(e) =>
                    setNewContact({
                      ...newContact,
                      relationship_type: e.target.value,
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {RELATIONSHIP_TYPES.filter((t) => t !== 'All').map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={newContact.linkedin_url}
                  onChange={(e) =>
                    setNewContact({ ...newContact, linkedin_url: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/..."
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                disabled={
                  saving || !newContact.first_name || !newContact.last_name
                }
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition"
              >
                {saving ? 'Saving...' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
