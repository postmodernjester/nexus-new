
'use client';

import { useEffect, useState } from 'react';

import { useRouter, useParams } from 'next/navigation';

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

  city: string | null;

  state: string | null;

  country: string | null;

  website: string | null;

  twitter_url: string | null;

  github_url: string | null;

  bio: string | null;

  created_at: string;

}

interface ContactNote {

  id: string;

  contact_id: string;

  owner_id: string;

  content: string;

  context: string | null;

  created_at: string;

}

const RELATIONSHIP_TYPES = [

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

export default function ContactDetailPage() {

  const router = useRouter();

  const params = useParams();

  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);

  const [notes, setNotes] = useState<ContactNote[]>([]);

  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);

  const [editForm, setEditForm] = useState<Partial<Contact>>({});

  const [saving, setSaving] = useState(false);

  // Notes

  const [newNote, setNewNote] = useState('');

  const [newNoteContext, setNewNoteContext] = useState('');

  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {

    fetchContact();

    fetchNotes();

  }, [contactId]);

  async function fetchContact() {

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {

      router.push('/login');

      return;

    }

    const { data, error } = await supabase

      .from('contacts')

      .select('*')

      .eq('id', contactId)

      .eq('owner_id', user.id)

      .single();

    if (error || !data) {

      console.error('Error fetching contact:', error);

      router.push('/contacts');

      return;

    }

    setContact(data);

    setEditForm(data);

    setLoading(false);

  }

  async function fetchNotes() {

    const { data, error } = await supabase

      .from('contact_notes')

      .select('*')

      .eq('contact_id', contactId)

      .order('created_at', { ascending: false });

    if (error) {

      console.error('Error fetching notes:', error);

    } else {

      setNotes(data || []);

    }

  }

  async function handleSaveContact() {

    setSaving(true);

    const { error } = await supabase

      .from('contacts')

      .update({

        first_name: editForm.first_name,

        last_name: editForm.last_name,

        email: editForm.email || null,

        phone: editForm.phone || null,

        company: editForm.company || null,

        job_title: editForm.job_title || null,

        relationship_type: editForm.relationship_type || null,

        linkedin_url: editForm.linkedin_url || null,

        city: editForm.city || null,

        state: editForm.state || null,

        country: editForm.country || null,

        website: editForm.website || null,

        twitter_url: editForm.twitter_url || null,

        github_url: editForm.github_url || null,

        bio: editForm.bio || null,

      })

      .eq('id', contactId);

    if (error) {

      console.error('Error updating contact:', error);

      alert('Failed to save: ' + error.message);

    } else {

      setContact({ ...contact!, ...editForm } as Contact);

      setEditing(false);

    }

    setSaving(false);

  }

  async function handleAddNote() {

    if (!newNote.trim()) return;

    setSavingNote(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase

      .from('contact_notes')

      .insert({

        contact_id: contactId,

        owner_id: user.id,

        content: newNote.trim(),

        context: newNoteContext.trim() || null,

      })

      .select()

      .single();

    if (error) {

      console.error('Error adding note:', error);

      alert('Failed to add note: ' + error.message);

    } else if (data) {

      setNotes([data, ...notes]);

      setNewNote('');

      setNewNoteContext('');

    }

    setSavingNote(false);

  }

  async function handleDeleteNote(noteId: string) {

    if (!confirm('Delete this note?')) return;

    const { error } = await supabase

      .from('contact_notes')

      .delete()

      .eq('id', noteId);

    if (error) {

      console.error('Error deleting note:', error);

    } else {

      setNotes(notes.filter((n) => n.id !== noteId));

    }

  }

  async function handleDeleteContact() {

    if (!confirm(`Delete ${contact?.first_name} ${contact?.last_name}? This cannot be undone.`))

      return;

    const { error } = await supabase

      .from('contacts')

      .delete()

      .eq('id', contactId);

    if (error) {

      console.error('Error deleting contact:', error);

      alert('Failed to delete: ' + error.message);

    } else {

      router.push('/contacts');

    }

  }

  function formatDate(dateStr: string) {

    return new Date(dateStr).toLocaleDateString('en-US', {

      year: 'numeric',

      month: 'short',

      day: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

    });

  }

  function getInitials(first: string, last: string) {

    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();

  }

  if (loading) {

    return (

      <div className="min-h-screen bg-black text-white flex items-center justify-center">

        <div className="text-gray-500">Loading contact...</div>

      </div>

    );

  }

  if (!contact) return null;

  return (

    <div className="min-h-screen bg-black text-white">

      {/* Header */}

      <div className="border-b border-gray-800 bg-gray-950">

        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">

          <button

            onClick={() => router.push('/contacts')}

            className="text-gray-400 hover:text-white transition"

          >

            ← All Contacts

          </button>

          <div className="flex items-center gap-2">

            {!editing && (

              <button

                onClick={() => setEditing(true)}

                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition"

              >

                Edit

              </button>

            )}

            <button

              onClick={handleDeleteContact}

              className="bg-red-900/50 hover:bg-red-900 text-red-400 px-4 py-2 rounded-lg text-sm transition"

            >

              Delete

            </button>

          </div>

        </div>

      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Profile Header Card */}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">

          {editing ? (

            <div className="space-y-4">

              <h2 className="text-lg font-bold mb-4">Edit Contact</h2>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="block text-sm text-gray-400 mb-1">First Name</label>

                  <input

                    type="text"

                    value={editForm.first_name || ''}

                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-400 mb-1">Last Name</label>

                  <input

                    type="text"

                    value={editForm.last_name || ''}

                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="block text-sm text-gray-400 mb-1">Job Title</label>

                  <input

                    type="text"

                    value={editForm.job_title || ''}

                    onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-400 mb-1">Company</label>

                  <input

                    type="text"

                    value={editForm.company || ''}

                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="block text-sm text-gray-400 mb-1">Email</label>

                  <input

                    type="email"

                    value={editForm.email || ''}

                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-400 mb-1">Phone</label>

                  <input

                    type="tel"

                    value={editForm.phone || ''}

                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

              </div>

              <div>

                <label className="block text-sm text-gray-400 mb-1">Relationship Type</label>

                <select

                  value={editForm.relationship_type || 'Other'}

                  onChange={(e) => setEditForm({ ...editForm, relationship_type: e.target.value })}

                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                >

                  {RELATIONSHIP_TYPES.map((type) => (

                    <option key={type} value={type}>{type}</option>

                  ))}

                </select>

              </div>

              <div className="grid grid-cols-3 gap-3">

                <div>

                  <label className="block text-sm text-gray-400 mb-1">City</label>

                  <input

                    type="text"

                    value={editForm.city || ''}

                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-400 mb-1">State</label>

                  <input

                    type="text"

                    value={editForm.state || ''}

                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-400 mb-1">Country</label>

                  <input

                    type="text"

                    value={editForm.country || ''}

                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}

                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"

                  />

                </div>

              </div>

              <div>

                <label className="block text-sm text-gray-400 mb-1">Bio / About</label>

                <textarea

                  value={editForm.bio || ''}

                  onChange={(e) => setEditForm({ ...edit
                         <textarea
                  value={editForm.bio || ''}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={editForm.linkedin_url || ''}
                  onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Website</label>
                  <input
                    type="url"
                    value={editForm.website || ''}
                    onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Twitter URL</label>
                  <input
                    type="url"
                    value={editForm.twitter_url || ''}
                    onChange={(e) => setEditForm({ ...editForm, twitter_url: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">GitHub URL</label>
                <input
                  type="url"
                  value={editForm.github_url || ''}
                  onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => { setEditing(false); setEditForm(contact); }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveContact}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-300 shrink-0">
                {getInitials(contact.first_name, contact.last_name)}
              </div>

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {contact.first_name} {contact.last_name}
                </h1>
                <p className="text-gray-400 mt-1">
                  {[contact.job_title, contact.company].filter(Boolean).join(' at ') || 'No title or company'}
                </p>
                {(contact.city || contact.state || contact.country) && (
                  <p className="text-gray-500 text-sm mt-1">
                    📍 {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
                  </p>
                )}
                {contact.relationship_type && (
                  <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-blue-600 text-white">
                    {contact.relationship_type}
                  </span>
                )}

                {/* Contact Links */}
                <div className="flex flex-wrap gap-3 mt-4 text-sm">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-blue-400 hover:text-blue-300">
                      ✉ {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="text-blue-400 hover:text-blue-300">
                      📱 {contact.phone}
                    </a>
                  )}
                  {contact.linkedin_url && (
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      LinkedIn ↗
                    </a>
                  )}
                  {contact.website && (
                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      Website ↗
                    </a>
                  )}
                  {contact.twitter_url && (
                    <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      Twitter ↗
                    </a>
                  )}
                  {contact.github_url && (
                    <a href={contact.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      GitHub ↗
                    </a>
                  )}
                </div>

                {contact.bio && (
                  <p className="text-gray-300 mt-4 text-sm leading-relaxed">{contact.bio}</p>
                )}

                <p className="text-gray-600 text-xs mt-4">
                  Added {formatDate(contact.created_at)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Public Information Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Public Information</h2>
            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded">Coming Soon</span>
          </div>
          <p className="text-gray-500 text-sm">
            This section will automatically populate with publicly available information about this person — 
            recent articles, company news, social media activity, and professional mentions found across the web.
          </p>
          <div className="mt-4 border border-dashed border-gray-700 rounded-lg p-8 text-center text-gray-600 text-sm">
            Web intelligence gathering will appear here in a future update.
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Notes</h2>

          {/* Add Note Form */}
          <div className="border border-gray-700 rounded-lg p-4 mb-6 bg-gray-850">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note about this person..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3"
            />
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newNoteContext}
                onChange={(e) => setNewNoteContext(e.target.value)}
                placeholder="Context (e.g. 'Coffee meeting', 'Phone call', 'Email thread')"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !newNote.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0"
              >
                {savingNote ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes List */}
          {notes.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">
              No notes yet. Add your first note above.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="border border-gray-800 rounded-lg p-4 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-gray-200 text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-gray-600 text-xs">{formatDate(note.created_at)}</span>
                        {note.context && (
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                            {note.context}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}                        
