'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Contact {
  id: string;
  owner_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  location: string | null;
  relationship_type: string | null;
  website: string | null;
  avatar_url: string | null;
  how_we_met: string | null;
  met_date: string | null;
  follow_up_status: string | null;
  last_contact_date: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
  communication_frequency: string | null;
  collaboration_depth: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  twitter_url: string | null;
  github_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string | null;
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
  'Colleague', 'Client', 'Friend', 'Mentor', 'Mentee',
  'Collaborator', 'Vendor', 'Recruiter', 'Other',
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
  const [newNote, setNewNote] = useState('');
  const [newNoteContext, setNewNoteContext] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => { fetchContact(); fetchNotes(); }, [contactId]);

  async function fetchContact() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data, error } = await supabase.from('contacts').select('*').eq('id', contactId).eq('owner_id', user.id).single();
    if (error || !data) { router.push('/contacts'); return; }
    setContact(data);
    setEditForm(data);
    setLoading(false);
  }

  async function fetchNotes() {
    const { data, error } = await supabase.from('contact_notes').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
    if (!error) setNotes(data || []);
  }

  async function handleSaveContact() {
    setSaving(true);
    const { error } = await supabase.from('contacts').update({
      full_name: editForm.full_name, email: editForm.email || null, phone: editForm.phone || null,
      company: editForm.company || null, role: editForm.role || null, location: editForm.location || null,
      relationship_type: editForm.relationship_type || null, website: editForm.website || null,
      how_we_met: editForm.how_we_met || null, met_date: editForm.met_date || null,
      follow_up_status: editForm.follow_up_status || null, last_contact_date: editForm.last_contact_date || null,
      next_action_date: editForm.next_action_date || null, next_action_note: editForm.next_action_note || null,
      city: editForm.city || null, state: editForm.state || null, country: editForm.country || null,
      twitter_url: editForm.twitter_url || null, github_url: editForm.github_url || null, bio: editForm.bio || null,
    }).eq('id', contactId);
    if (error) { alert('Failed to save: ' + error.message); }
    else { setContact({ ...contact!, ...editForm } as Contact); setEditing(false); }
    setSaving(false);
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('contact_notes').insert({ contact_id: contactId, owner_id: user.id, content: newNote.trim(), context: newNoteContext.trim() || null }).select().single();
    if (error) { alert('Failed to add note: ' + error.message); }
    else if (data) { setNotes([data, ...notes]); setNewNote(''); setNewNoteContext(''); }
    setSavingNote(false);
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Delete this note?')) return;
    const { error } = await supabase.from('contact_notes').delete().eq('id', noteId);
    if (!error) setNotes(notes.filter((n) => n.id !== noteId));
  }

  async function handleDeleteContact() {
    if (!confirm('Delete ' + contact?.full_name + '? This cannot be undone.')) return;
    const { error } = await supabase.from('contacts').delete().eq('id', contactId);
    if (!error) router.push('/contacts');
    else alert('Failed to delete: ' + error.message);
  }

  function fmt(d: string) { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function fmtShort(d: string | null) { if (!d) return null; return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function initials(name: string) { const p = name.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase(); }

  if (loading) return (<div className="min-h-screen bg-black text-white flex items-center justify-center"><div className="text-gray-500">Loading...</div></div>);
  if (!contact) return null;

  const ef = editForm;
  const s = (k: keyof Contact, v: string) => setEditForm({ ...ef, [k]: v });
  const inp = (label: string, key: keyof Contact, type?: string) => (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input type={type || 'text'} value={(ef[key] as string) || ''} onChange={(e) => s(key, e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/contacts')} className="text-gray-400 hover:text-white transition">← All Contacts</button>
          <div className="flex items-center gap-2">
            {!editing && <button onClick={() => setEditing(true)} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition">Edit</button>}
            <button onClick={handleDeleteContact} className="bg-red-900/50 hover:bg-red-900 text-red-400 px-4 py-2 rounded-lg text-sm transition">Delete</button>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {editing ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-4">Edit Contact</h2>
              {inp('Full Name', 'full_name')}
              <div className="grid grid-cols-2 gap-3">{inp('Role / Title', 'role')}{inp('Company', 'company')}</div>
              <div className="grid grid-cols-2 gap-3">{inp('Email', 'email', 'email')}{inp('Phone', 'phone', 'tel')}</div>
              {inp('Location', 'location')}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Relationship Type</label>
                <select value={ef.relationship_type || 'Other'} onChange={(e) => s('relationship_type', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500">
                  {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">{inp('How We Met', 'how_we_met')}{inp('Met Date', 'met_date', 'date')}</div>
              <div className="grid grid-cols-2 gap-3">
                {inp('Last Contact Date', 'last_contact_date', 'date')}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Follow-up Status</label>
                  <select value={ef.follow_up_status || ''} onChange={(e) => s('follow_up_status', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500">
                    <option value="">None</option>
                    <option value="pending">Pending</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="overdue">Overdue</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">{inp('Next Action Date', 'next_action_date', 'date')}{inp('Next Action Note', 'next_action_note')}</div>
              <div className="grid grid-cols-3 gap-3">{inp('City', 'city')}{inp('State', 'state')}{inp('Country', 'country')}</div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bio / About</label>
                <textarea value={ef.bio || ''} onChange={(e) => s('bio', e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">{inp('Website', 'website', 'url')}{inp('Twitter URL', 'twitter_url', 'url')}</div>
              {inp('GitHub URL', 'github_url', 'url')}
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setEditing(false); setEditForm(contact); }} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
                <button onClick={handleSaveContact} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-300 shrink-0">{initials(contact.full_name)}</div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{contact.full_name}</h1>
                <p className="text-gray-400 mt-1">{[contact.role, contact.company].filter(Boolean).join(' at ') || 'No role or company'}</p>
                {contact.location && <p className="text-gray-500 text-sm mt-1">📍 {contact.location}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {contact.relationship_type && <span className="text-xs px-3 py-1 rounded-full bg-blue-600 text-white">{contact.relationship_type}</span>}
                  {contact.follow_up_status && <span className={'text-xs px-3 py-1 rounded-full text-white ' + (contact.follow_up_status === 'overdue' ? 'bg-red-600' : contact.follow_up_status === 'pending' ? 'bg-yellow-600' : contact.follow_up_status === 'scheduled' ? 'bg-blue-600' : 'bg-green-600')}>{contact.follow_up_status}</span>}
                </div>
                <div className="flex flex-wrap gap-3 mt-4 text-sm">
                  {contact.email && <a href={'mailto:' + contact.email} className="text-blue-400 hover:text-blue-300">✉ {contact.email}</a>}
                  {contact.phone && <a href={'tel:' + contact.phone} className="text-blue-400 hover:text-blue-300">📱 {contact.phone}</a>}
                  {contact.website && <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Website ↗</a>}
                  {contact.twitter_url && <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Twitter ↗</a>}
                  {contact.github_url && <a href={contact.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">GitHub ↗</a>}
                </div>
                {contact.bio && <p className="text-gray-300 mt-4 text-sm leading-relaxed">{contact.bio}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-800">
                  {contact.how_we_met && <div><span className="text-xs text-gray-500 block">How we met</span><span className="text-sm text-gray-300">{contact.how_we_met}</span></div>}
                  {contact.met_date && <div><span className="text-xs text-gray-500 block">Met date</span><span className="text-sm text-gray-300">{fmtShort(contact.met_date)}</span></div>}
                  {contact.last_contact_date && <div><span className="text-xs text-gray-500 block">Last contact</span><span className="text-sm text-gray-300">{fmtShort(contact.last_contact_date)}</span></div>}
                  {contact.next_action_date && <div><span className="text-xs text-gray-500 block">Next action</span><span className="text-sm text-gray-300">{fmtShort(contact.next_action_date)}</span></div>}
                  {contact.next_action_note && <div className="col-span-2"><span className="text-xs text-gray-500 block">Action note</span><span className="text-sm text-gray-300">{contact.next_action_note}</span></div>}
                </div>
                <p className="text-gray-600 text-xs mt-4">Added {fmt(contact.created_at)}</p>
              </div>
            </div>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Public Information</h2>
            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded">Coming Soon</span>
          </div>
          <p className="text-gray-500 text-sm">This section will automatically populate with publicly available information — articles, company news, social media activity, and professional mentions.</p>
          <div className="mt-4 border border-dashed border-gray-700 rounded-lg p-8 text-center text-gray-600 text-sm">Web intelligence gathering will appear here in a future update.</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Notes</h2>
          <div className="border border-gray-700 rounded-lg p-4 mb-6">
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Write a note about this person..." rows={3} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3" />
            <div className="flex items-center gap-3">
              <input type="text" value={newNoteContext} onChange={(e) => setNewNoteContext(e.target.value)} placeholder="Context (e.g. Coffee meeting, Phone call)" className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <button onClick={handleAddNote} disabled={savingNote || !newNote.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0">{savingNote ? 'Saving...' : 'Add Note'}</button>
            </div>
          </div>
          {notes.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">No notes yet. Add your first note above.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="border border-gray-800 rounded-lg p-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-gray-200 text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-gray-600 text-xs">{fmt(note.created_at)}</span>
                        {note.context && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{note.context}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteNote(note.id)} className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-sm">✕</button>
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
