'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Contact { id: string; owner_id: string; full_name: string; email: string | null; phone: string | null; company: string | null; role: string | null; location: string | null; relationship_type: string | null; website: string | null; avatar_url: string | null; linkedin_url: string | null; follow_up_status: string | null; last_contact_date: string | null; next_action_date: string | null; next_action_note: string | null; city: string | null; state: string | null; country: string | null; twitter_url: string | null; github_url: string | null; bio: string | null; ai_summary: string | null; created_at: string; updated_at: string | null; }

interface JournalEntry { id: string; contact_id: string; owner_id: string; content: string; context: string | null; entry_date: string; created_at: string; }

const REL_TYPES = ['Family', 'Close Friend', 'Business Contact', 'Acquaintance', 'Stranger'];

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cid = params.id as string;
  const [c, setC] = useState<Contact | null>(null);
  const [j, setJ] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [ne, setNe] = useState('');
  const [nc, setNc] = useState('');
  const [nd, setNd] = useState(new Date().toISOString().split('T')[0]);
  const [se, setSe] = useState(false);
  const [eid, setEid] = useState<string | null>(null);
  const [eec, setEec] = useState('');
  const [eed, setEed] = useState('');
  const [eex, setEex] = useState('');

  useEffect(() => { load(); loadJ(); }, [cid]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data } = await supabase.from('contacts').select('*').eq('id', cid).eq('owner_id', user.id).single();
    if (!data) { router.push('/contacts'); return; }
    setC(data); setEf(data); setLoading(false);
  }

  async function loadJ() {
    const { data } = await supabase.from('contact_notes').select('*').eq('contact_id', cid).order('entry_date', { ascending: false });
    setJ(data || []);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('contacts').update({ full_name: ef.full_name, email: ef.email || null, phone: ef.phone || null, company: ef.company || null, role: ef.role || null, location: ef.location || null, relationship_type: ef.relationship_type || null, website: ef.website || null, linkedin_url: ef.linkedin_url || null, follow_up_status: ef.follow_up_status || null, last_contact_date: ef.last_contact_date || null, next_action_date: ef.next_action_date || null, next_action_note: ef.next_action_note || null, city: ef.city || null, state: ef.state || null, country: ef.country || null, twitter_url: ef.twitter_url || null, github_url: ef.github_url || null, bio: ef.bio || null, ai_summary: ef.ai_summary || null }).eq('id', cid);
    if (error) alert('Failed: ' + error.message);
    else { setC({ ...c!, ...ef } as Contact); setEditing(false); }
    setSaving(false);
  }

  async function addE() {
    if (!ne.trim()) return; setSe(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('contact_notes').insert({ contact_id: cid, owner_id: user.id, content: ne.trim(), context: nc.trim() || null, entry_date: nd }).select().single();
    if (error) alert('Failed: ' + error.message);
    else if (data) { setJ([data, ...j]); setNe(''); setNc(''); setNd(new Date().toISOString().split('T')[0]); }
    setSe(false);
  }

  async function upE(id: string) {
    const { error } = await supabase.from('contact_notes').update({ content: eec, entry_date: eed, context: eex || null }).eq('id', id);
    if (error) alert('Failed: ' + error.message);
    else { setJ(j.map(x => x.id === id ? { ...x, content: eec, entry_date: eed, context: eex || null } : x)); setEid(null); }
  }

  async function delE(id: string) {
    if (!confirm('Delete this entry?')) return;
    await supabase.from('contact_notes').delete().eq('id', id);
    setJ(j.filter(x => x.id !== id));
  }

  async function delC() {
    if (!confirm('Delete ' + c?.full_name + '?')) return;
    await supabase.from('contacts').delete().eq('id', cid);
    router.push('/contacts');
  }

  function fmt(d: string) { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function ini(n: string) { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); }
  const sf = (k: string, v: string) => setEf({ ...ef, [k]: v });
  const inp = (l: string, k: string, t?: string, p?: string) => (<div><label className="block text-sm text-gray-400 mb-1">{l}</label><input type={t || 'text'} value={(ef as any)[k] || ''} onChange={(e) => sf(k, e.target.value)} placeholder={p} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" /></div>);
  const rc = (t: string) => t === 'Family' ? 'bg-red-600' : t === 'Close Friend' ? 'bg-purple-600' : t === 'Business Contact' ? 'bg-blue-600' : t === 'Acquaintance' ? 'bg-gray-600' : 'bg-gray-700';

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center"><div className="text-gray-500">Loading...</div></div>;
  if (!c) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/contacts')} className="text-gray-400 hover:text-white transition">← All Contacts</button>
          <div className="flex items-center gap-2">
            {!editing && <button onClick={() => setEditing(true)} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition">Edit</button>}
            <button onClick={delC} className="bg-red-900/50 hover:bg-red-900 text-red-400 px-4 py-2 rounded-lg text-sm transition">Delete</button>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {editing ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-2">Edit Profile</h2>
              {inp('Full Name', 'full_name')}
              <div className="grid grid-cols-2 gap-3">{inp('Role / Title', 'role')}{inp('Company', 'company')}</div>
              <div className="grid grid-cols-2 gap-3">{inp('Email', 'email', 'email')}{inp('Phone', 'phone', 'tel')}</div>
              {inp('Location', 'location', 'text', 'City, State or general area')}
              <div><label className="block text-sm text-gray-400 mb-1">Relationship</label><select value={ef.relationship_type || 'Acquaintance'} onChange={(e) => sf('relationship_type', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500">{REL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              {inp('LinkedIn URL', 'linkedin_url', 'url', 'https://linkedin.com/in/...')}
              <div className="grid grid-cols-2 gap-3">{inp('Website', 'website', 'url')}{inp('Twitter', 'twitter_url', 'url')}</div>
              {inp('GitHub', 'github_url', 'url')}
              <div className="grid grid-cols-3 gap-3">{inp('City', 'city')}{inp('State', 'state')}{inp('Country', 'country')}</div>
              <div><label className="block text-sm text-gray-400 mb-1">Bio / About</label><textarea value={ef.bio || ''} onChange={(e) => sf('bio', e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">AI Summary</label><textarea value={ef.ai_summary || ''} onChange={(e) => sf('ai_summary', e.target.value)} rows={3} placeholder="AI-generated summary of this person..." className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                {inp('Last Contact Date', 'last_contact_date', 'date')}
                <div><label className="block text-sm text-gray-400 mb-1">Follow-up Status</label><select value={ef.follow_up_status || ''} onChange={(e) => sf('follow_up_status', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"><option value="">None</option><option value="pending">Pending</option><option value="scheduled">Scheduled</option><option value="overdue">Overdue</option><option value="done">Done</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">{inp('Next Action Date', 'next_action_date', 'date')}{inp('Next Action Note', 'next_action_note')}</div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setEditing(false); setEf(c); }} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
                <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-300 shrink-0">{ini(c.full_name)}</div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{c.full_name}</h1>
                <p className="text-gray-400 mt-1">{[c.role, c.company].filter(Boolean).join(' at ') || 'No details yet'}</p>
                {c.location && <p className="text-gray-500 text-sm mt-1">📍 {c.location}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {c.relationship_type && <span className={'text-xs px-3 py-1 rounded-full text-white ' + rc(c.relationship_type)}>{c.relationship_type}</span>}
                  {c.follow_up_status && <span className={'text-xs px-3 py-1 rounded-full text-white ' + (c.follow_up_status === 'overdue' ? 'bg-red-600' : c.follow_up_status === 'pending' ? 'bg-yellow-600' : 'bg-green-600')}>{c.follow_up_status}</span>}
                </div>
                <div className="flex flex-wrap gap-3 mt-4 text-sm">
                  {c.email && <a href={'mailto:' + c.email} className="text-blue-400 hover:text-blue-300">✉ {c.email}</a>}
                  {c.phone && <a href={'tel:' + c.phone} className="text-blue-400 hover:text-blue-300">📱 {c.phone}</a>}
                  {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">LinkedIn ↗</a>}
                  {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Website ↗</a>}
                  {c.twitter_url && <a href={c.twitter_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Twitter ↗</a>}
                  {c.github_url && <a href={c.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">GitHub ↗</a>}
                </div>
                {c.bio && <p className="text-gray-300 mt-4 text-sm leading-relaxed">{c.bio}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-800">
                  {c.last_contact_date && <div><span className="text-xs text-gray-500 block">Last contact</span><span className="text-sm text-gray-300">{fmt(c.last_contact_date)}</span></div>}
                  {c.next_action_date && <div><span className="text-xs text-gray-500 block">Next action</span><span className="text-sm text-gray-300">{fmt(c.next_action_date)}</span></div>}
                  {c.next_action_note && <div className="col-span-2"><span className="text-xs text-gray-500 block">Action note</span><span className="text-sm text-gray-300">{c.next_action_note}</span></div>}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-3">AI Summary</h2>
          {c.ai_summary ? <p className="text-gray-300 text-sm leading-relaxed">{c.ai_summary}</p> : <p className="text-gray-600 text-sm">No AI summary yet. Click Edit to add one, or this will auto-generate in a future update.</p>}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Public Information</h2><span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded">Coming Soon</span></div>
          <div className="border border-dashed border-gray-700 rounded-lg p-8 text-center text-gray-600 text-sm">Web-sourced information about this person will appear here.</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Interaction Journal</h2>
          <div className="border border-gray-700 rounded-lg p-4 mb-6">
            <textarea value={ne} onChange={(e) => setNe(e.target.value)} placeholder="Log an interaction... (how you met, a conversation, an article you read about them, anything)" rows={3} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3" />
            <div className="flex items-center gap-3 flex-wrap">
              <input type="date" value={nd} onChange={(e) => setNd(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
              <input type="text" value={nc} onChange={(e) => setNc(e.target.value)} placeholder="Context (e.g. Coffee, Phone, Email, Article)" className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <button onClick={addE} disabled={se || !ne.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0">{se ? 'Saving...' : 'Add Entry'}</button>
            </div>
          </div>
          {j.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">No journal entries yet. Start by logging how you first encountered this person.</p>
          ) : (
            <div className="space-y-3">
              {j.map((entry) => (
                <div key={entry.id} className="border border-gray-800 rounded-lg p-4 group">
                  {eid === entry.id ? (
                    <div className="space-y-3">
                      <textarea value={eec} onChange={(e) => setEec(e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
                      <div className="flex items-center gap-3">
                        <input type="date" value={eed} onChange={(e) => setEed(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
                        <input type="text" value={eex} onChange={(e) => setEex(e.target.value)} placeholder="Context" className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                        <button onClick={() => upE(entry.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition">Save</button>
                        <button onClick={() => setEid(null)} className="text-gray-400 hover:text-white px-3 py-2 text-sm transition">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-gray-200 text-sm whitespace-pre-wrap">{entry.content}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-gray-600 text-xs">{fmt(entry.entry_date)}</span>
                          {entry.context && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{entry.context}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => { setEid(entry.id); setEec(entry.content); setEed(entry.entry_date); setEex(entry.context || ''); }} className="text-gray-600 hover:text-blue-400 text-sm px-1">✎</button>
                        <button onClick={() => delE(entry.id)} className="text-gray-700 hover:text-red-400 text-sm px-1">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
