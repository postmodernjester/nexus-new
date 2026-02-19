"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ─── Nav ───
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/network", label: "Network" },
  { href: "/contacts", label: "Contacts" },
];

function Nav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        background: "#0f172a",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <Link
        href="/dashboard"
        style={{
          fontSize: "18px",
          fontWeight: "bold",
          color: "#fff",
          textDecoration: "none",
          letterSpacing: "-0.5px",
        }}
      >
        NEXUS
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                textDecoration: "none",
                color: active ? "#0f172a" : "#94a3b8",
                background: active ? "#fff" : "transparent",
                transition: "all 0.15s",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Types ───
interface Contact {
  id: string;
  owner_id: string;
  linked_profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  location: string | null;
  relationship_type: string | null;
  website: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  follow_up_status: string | null;
  last_contact_date: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  twitter_url: string | null;
  github_url: string | null;
  bio: string | null;
  ai_summary: string | null;
  how_we_met: string | null;
  met_date: string | null;
  communication_frequency: number | null;
  collaboration_depth: number | null;
  created_at: string;
  updated_at: string | null;
}

interface LinkedProfile {
  full_name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar_url: string | null;
}

interface NoteEntry {
  id: string;
  contact_id: string;
  owner_id: string;
  content: string;
  context: string | null;
  entry_date: string;
  created_at: string;
}

const REL_TYPES = [
  "Family",
  "Close Friend",
  "Friend",
  "Colleague",
  "Business Contact",
  "Acquaintance",
  "Other",
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// Detect URLs in text and make them clickable
function renderContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex
      urlRegex.lastIndex = 0;
      const domain = new URL(part).hostname.replace("www.", "");
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#60a5fa",
            textDecoration: "none",
            borderBottom: "1px solid rgba(96,165,250,0.3)",
            wordBreak: "break-all",
          }}
        >
          {domain}
          <span style={{ fontSize: "10px", marginLeft: "3px", opacity: 0.5 }}>
            ↗
          </span>
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Styles ───
const s = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e2e8f0",
  } as React.CSSProperties,
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "24px 20px 60px",
  } as React.CSSProperties,
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: "11px",
    color: "#64748b",
    marginBottom: "4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "14px",
    outline: "none",
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    padding: "10px 12px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "14px",
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
    lineHeight: "1.5",
  } as React.CSSProperties,
  select: {
    width: "100%",
    padding: "8px 12px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "14px",
    outline: "none",
  } as React.CSSProperties,
  btnPrimary: {
    padding: "8px 20px",
    background: "#a78bfa",
    color: "#0f172a",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  } as React.CSSProperties,
  btnSecondary: {
    padding: "8px 16px",
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  } as React.CSSProperties,
  btnDanger: {
    padding: "6px 14px",
    background: "rgba(220,38,38,0.15)",
    color: "#f87171",
    border: "1px solid rgba(220,38,38,0.3)",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
  } as React.CSSProperties,
};

export default function ContactDossierPage() {
  const router = useRouter();
  const params = useParams();
  const cid = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [linkedProfile, setLinkedProfile] = useState<LinkedProfile | null>(
    null
  );
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);

  // New note
  const [noteText, setNoteText] = useState("");
  const [noteContext, setNoteContext] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Edit note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [editNoteContext, setEditNoteContext] = useState("");

  // AI summary
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    loadContact();
    loadNotes();
  }, [cid]);

  async function loadContact() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", cid)
      .eq("owner_id", user.id)
      .single();
    if (!data) {
      router.push("/contacts");
      return;
    }
    setContact(data);
    setEditFields(data);

    // Load linked profile if exists
    if (data.linked_profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, headline, bio, location, website, avatar_url")
        .eq("id", data.linked_profile_id)
        .single();
      if (profile) setLinkedProfile(profile);
    }

    setLoading(false);
  }

  async function loadNotes() {
    const { data } = await supabase
      .from("contact_notes")
      .select("*")
      .eq("contact_id", cid)
      .order("entry_date", { ascending: false });
    setNotes(data || []);
  }

  async function saveContact() {
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({
        full_name: editFields.full_name,
        email: editFields.email || null,
        phone: editFields.phone || null,
        company: editFields.company || null,
        role: editFields.role || null,
        location: editFields.location || null,
        relationship_type: editFields.relationship_type || null,
        how_we_met: editFields.how_we_met || null,
        met_date: editFields.met_date || null,
        follow_up_status: editFields.follow_up_status || null,
        last_contact_date: editFields.last_contact_date || null,
        next_action_date: editFields.next_action_date || null,
        next_action_note: editFields.next_action_note || null,
      })
      .eq("id", cid);
    if (error) {
      alert("Failed: " + error.message);
    } else {
      setContact({ ...contact!, ...editFields } as Contact);
      setEditing(false);
    }
    setSaving(false);
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: cid,
        owner_id: user.id,
        content: noteText.trim(),
        context: noteContext.trim() || null,
        entry_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();
    if (error) {
      alert("Failed: " + error.message);
    } else if (data) {
      setNotes([data, ...notes]);
      setNoteText("");
      setNoteContext("");
    }
    setAddingNote(false);
  }

  async function updateNote(id: string) {
    const { error } = await supabase
      .from("contact_notes")
      .update({
        content: editNoteContent,
        context: editNoteContext || null,
      })
      .eq("id", id);
    if (error) {
      alert("Failed: " + error.message);
    } else {
      setNotes(
        notes.map((n) =>
          n.id === id
            ? { ...n, content: editNoteContent, context: editNoteContext || null }
            : n
        )
      );
      setEditingNoteId(null);
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("contact_notes").delete().eq("id", id);
    setNotes(notes.filter((n) => n.id !== id));
  }

  async function deleteContact() {
    if (!confirm("Delete " + contact?.full_name + "?")) return;
    await supabase.from("contacts").delete().eq("id", cid);
    router.push("/contacts");
  }

  async function generateAISummary() {
    setGeneratingSummary(true);

    // Gather all context
    const allNotes = notes.map((n) => `[${n.entry_date}] ${n.content}`).join("\n");
    const contactInfo = [
      contact?.full_name && `Name: ${contact.full_name}`,
      contact?.role && `Role: ${contact.role}`,
      contact?.company && `Company: ${contact.company}`,
      contact?.location && `Location: ${contact.location}`,
      contact?.relationship_type && `Relationship: ${contact.relationship_type}`,
      contact?.how_we_met && `How we met: ${contact.how_we_met}`,
      contact?.bio && `Bio: ${contact.bio}`,
      linkedProfile?.headline && `Their headline: ${linkedProfile.headline}`,
      linkedProfile?.bio && `Their bio: ${linkedProfile.bio}`,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `You are writing a brief professional dossier summary about a person for a networking CRM. Write 2-3 sentences in an academic, unemotional, professional tone. Focus on what would be useful for someone who is networking — their role, expertise, where they work, how you know them, and any notable context from the notes. Do not use flowery language. Do not speculate beyond what is stated.

Contact information:
${contactInfo}

Notes and research:
${allNotes || "(No notes yet)"}

Write the summary paragraph:`;

    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        // Fallback: generate a simple summary from available data
        const parts = [];
        if (contact?.full_name) parts.push(contact.full_name);
        if (contact?.role && contact?.company)
          parts.push(`serves as ${contact.role} at ${contact.company}`);
        else if (contact?.role) parts.push(`works as ${contact.role}`);
        else if (contact?.company) parts.push(`is affiliated with ${contact.company}`);
        if (contact?.location) parts.push(`based in ${contact.location}`);
        if (contact?.how_we_met) parts.push(`Connection originated via ${contact.how_we_met}.`);
        if (contact?.relationship_type)
          parts.push(`Classified as ${contact.relationship_type?.toLowerCase()}.`);

        const summary = parts.join(". ") + ".";
        await supabase
          .from("contacts")
          .update({ ai_summary: summary })
          .eq("id", cid);
        setContact((prev) => prev ? { ...prev, ai_summary: summary } : prev);
      } else {
        const data = await response.json();
        const summary = data.summary || data.text || data.content || "";
        if (summary) {
          await supabase
            .from("contacts")
            .update({ ai_summary: summary })
            .eq("id", cid);
          setContact((prev) => prev ? { ...prev, ai_summary: summary } : prev);
        }
      }
    } catch (e) {
      // Fallback summary
      const summary = `${contact?.full_name || "This contact"}${contact?.role ? ` is a ${contact.role}` : ""}${contact?.company ? ` at ${contact.company}` : ""}. ${contact?.relationship_type ? `Classified as ${contact.relationship_type.toLowerCase()}.` : ""}`;
      await supabase
        .from("contacts")
        .update({ ai_summary: summary })
        .eq("id", cid);
      setContact((prev) => prev ? { ...prev, ai_summary: summary } : prev);
    }

    setGeneratingSummary(false);
  }

  function handleNoteKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      addNote();
    }
  }

  const setField = (k: string, v: string) =>
    setEditFields({ ...editFields, [k]: v });

  if (loading) {
    return (
      <div style={s.page}>
        <Nav />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            color: "#64748b",
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div style={s.page}>
      <Nav />

      <div style={s.container}>
        {/* Back + actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <Link
            href="/contacts"
            style={{
              color: "#64748b",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            ← All Contacts
          </Link>
          <div style={{ display: "flex", gap: "8px" }}>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                style={s.btnSecondary}
              >
                Edit
              </button>
            )}
            <button onClick={deleteContact} style={s.btnDanger}>
              Delete
            </button>
          </div>
        </div>

        {/* ═══ HEADER ═══ */}
        <div style={{ ...s.card, display: "flex", gap: "16px", alignItems: "flex-start" }}>
          {/* Avatar */}
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#a78bfa22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#a78bfa",
              fontSize: "22px",
              fontWeight: "bold",
              flexShrink: 0,
            }}
          >
            {contact.avatar_url ? (
              <img
                src={contact.avatar_url}
                alt=""
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              initials(contact.full_name)
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>
              {contact.full_name}
            </h1>
            {(contact.role || contact.company) && (
              <div style={{ color: "#94a3b8", fontSize: "14px", marginTop: "2px" }}>
                {[contact.role, contact.company].filter(Boolean).join(" · ")}
              </div>
            )}
            {contact.location && (
              <div style={{ color: "#64748b", fontSize: "13px", marginTop: "2px" }}>
                {contact.location}
              </div>
            )}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
              {contact.relationship_type && (
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 10px",
                    borderRadius: "10px",
                    background: "#334155",
                    color: "#94a3b8",
                  }}
                >
                  {contact.relationship_type}
                </span>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  style={{ fontSize: "12px", color: "#60a5fa", textDecoration: "none" }}
                >
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {contact.phone}
                </span>
              )}
            </div>
          </div>

          {/* Linked indicator */}
          {linkedProfile && (
            <div
              style={{
                padding: "4px 10px",
                background: "rgba(96,165,250,0.15)",
                border: "1px solid rgba(96,165,250,0.3)",
                borderRadius: "6px",
                fontSize: "11px",
                color: "#60a5fa",
                whiteSpace: "nowrap",
              }}
            >
              ● Linked
            </div>
          )}
        </div>

        {/* ═══ AI SUMMARY ═══ */}
        <div style={s.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Dossier Summary
            </span>
            <button
              onClick={generateAISummary}
              disabled={generatingSummary}
              style={{
                ...s.btnSecondary,
                fontSize: "11px",
                padding: "4px 12px",
                opacity: generatingSummary ? 0.5 : 1,
              }}
            >
              {generatingSummary
                ? "Generating…"
                : contact.ai_summary
                  ? "Regenerate"
                  : "Generate"}
            </button>
          </div>
          {contact.ai_summary ? (
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                lineHeight: "1.7",
                color: "#cbd5e1",
                fontStyle: "italic",
              }}
            >
              {contact.ai_summary}
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#475569",
                fontStyle: "italic",
              }}
            >
              No summary yet. Add notes below, then click Generate to create an
              AI-synthesized profile of this person.
            </p>
          )}
        </div>

        {/* ═══ LINKED PROFILE (their data) ═══ */}
        {linkedProfile && (
          <div
            style={{
              ...s.card,
              borderColor: "rgba(96,165,250,0.2)",
              background: "rgba(30,41,59,0.7)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#60a5fa",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "10px",
              }}
            >
              Their Profile (auto-updated)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                fontSize: "13px",
              }}
            >
              {linkedProfile.headline && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b" }}>Headline: </span>
                  <span style={{ color: "#e2e8f0" }}>
                    {linkedProfile.headline}
                  </span>
                </div>
              )}
              {linkedProfile.bio && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b" }}>Bio: </span>
                  <span style={{ color: "#e2e8f0" }}>{linkedProfile.bio}</span>
                </div>
              )}
              {linkedProfile.location && (
                <div>
                  <span style={{ color: "#64748b" }}>Location: </span>
                  <span style={{ color: "#e2e8f0" }}>
                    {linkedProfile.location}
                  </span>
                </div>
              )}
              {linkedProfile.website && (
                <div>
                  <span style={{ color: "#64748b" }}>Website: </span>
                  <a
                    href={linkedProfile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#60a5fa", textDecoration: "none" }}
                  >
                    {new URL(linkedProfile.website).hostname.replace(
                      "www.",
                      ""
                    )}
                    <span style={{ fontSize: "10px", marginLeft: "3px" }}>
                      ↗
                    </span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ YOUR DETAILS (edit mode) ═══ */}
        {editing && (
          <div style={s.card}>
            <div
              style={{
                fontSize: "11px",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "14px",
              }}
            >
              Your Info
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>Full Name</label>
                <input
                  style={s.input}
                  value={editFields.full_name || ""}
                  onChange={(e) => setField("full_name", e.target.value)}
                />
              </div>
              <div>
                <label style={s.label}>Role / Title</label>
                <input
                  style={s.input}
                  value={editFields.role || ""}
                  onChange={(e) => setField("role", e.target.value)}
                />
              </div>
              <div>
                <label style={s.label}>Company</label>
                <input
                  style={s.input}
                  value={editFields.company || ""}
                  onChange={(e) => setField("company", e.target.value)}
                />
              </div>
              <div>
                <label style={s.label}>Email</label>
                <input
                  style={s.input}
                  type="email"
                  value={editFields.email || ""}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </div>
              <div>
                <label style={s.label}>Phone</label>
                <input
                  style={s.input}
                  value={editFields.phone || ""}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>Location</label>
                <input
                  style={s.input}
                  value={editFields.location || ""}
                  onChange={(e) => setField("location", e.target.value)}
                  placeholder="City, State or general area"
                />
              </div>
              <div>
                <label style={s.label}>Relationship</label>
                <select
                  style={s.select}
                  value={editFields.relationship_type || "Acquaintance"}
                  onChange={(e) => setField("relationship_type", e.target.value)}
                >
                  {REL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Follow-up Status</label>
                <select
                  style={s.select}
                  value={editFields.follow_up_status || ""}
                  onChange={(e) => setField("follow_up_status", e.target.value)}
                >
                  <option value="">None</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="overdue">Overdue</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label style={s.label}>How We Met</label>
                <input
                  style={s.input}
                  value={editFields.how_we_met || ""}
                  onChange={(e) => setField("how_we_met", e.target.value)}
                  placeholder="Conference, mutual friend, etc."
                />
              </div>
              <div>
                <label style={s.label}>Met Date</label>
                <input
                  style={s.input}
                  type="date"
                  value={editFields.met_date || ""}
                  onChange={(e) => setField("met_date", e.target.value)}
                />
              </div>
              <div>
                <label style={s.label}>Last Contact</label>
                <input
                  style={s.input}
                  type="date"
                  value={editFields.last_contact_date || ""}
                  onChange={(e) => setField("last_contact_date", e.target.value)}
                />
              </div>
              <div>
                <label style={s.label}>Next Action Date</label>
                <input
                  style={s.input}
                  type="date"
                  value={editFields.next_action_date || ""}
                  onChange={(e) => setField("next_action_date", e.target.value)}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>Next Action Note</label>
                <input
                  style={s.input}
                  value={editFields.next_action_note || ""}
                  onChange={(e) => setField("next_action_note", e.target.value)}
                  placeholder="Follow up about..."
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <button
                onClick={() => {
                  setEditing(false);
                  setEditFields(contact);
                }}
                style={s.btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={saveContact}
                disabled={saving}
                style={{ ...s.btnPrimary, opacity: saving ? 0.5 : 1 }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* ═══ DETAILS (read mode) ═══ */}
        {!editing && (
          <div style={s.card}>
            <div
              style={{
                fontSize: "11px",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "10px",
              }}
            >
              Your Info
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 16px",
                fontSize: "13px",
              }}
            >
              {contact.how_we_met && (
                <div>
                  <span style={{ color: "#64748b" }}>How we met: </span>
                  <span>{contact.how_we_met}</span>
                </div>
              )}
              {contact.met_date && (
                <div>
                  <span style={{ color: "#64748b" }}>Met: </span>
                  <span>{formatDate(contact.met_date)}</span>
                </div>
              )}
              {contact.last_contact_date && (
                <div>
                  <span style={{ color: "#64748b" }}>Last contact: </span>
                  <span>{formatDate(contact.last_contact_date)}</span>
                </div>
              )}
              {contact.follow_up_status && (
                <div>
                  <span style={{ color: "#64748b" }}>Follow-up: </span>
                  <span
                    style={{
                      color:
                        contact.follow_up_status === "overdue"
                          ? "#f87171"
                          : contact.follow_up_status === "pending"
                            ? "#fbbf24"
                            : "#e2e8f0",
                    }}
                  >
                    {contact.follow_up_status}
                  </span>
                </div>
              )}
              {contact.next_action_date && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b" }}>Next action: </span>
                  <span>
                    {formatDate(contact.next_action_date)}
                    {contact.next_action_note && ` — ${contact.next_action_note}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ NOTES / RESEARCH ═══ */}
        <div style={s.card}>
          <div
            style={{
              fontSize: "11px",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "14px",
            }}
          >
            Notes & Research
          </div>

          {/* Add note input */}
          <div
            style={{
              marginBottom: "20px",
              background: "#0f172a",
              borderRadius: "8px",
              border: "1px solid #334155",
              overflow: "hidden",
            }}
          >
            <textarea
              ref={noteInputRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleNoteKeyDown}
              placeholder="Add a note, paste a URL, research info, anything…"
              rows={3}
              style={{
                ...s.textarea,
                border: "none",
                borderRadius: "8px 8px 0 0",
                background: "transparent",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderTop: "1px solid #1e293b",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  value={noteContext}
                  onChange={(e) => setNoteContext(e.target.value)}
                  placeholder="context (meeting, email, research…)"
                  style={{
                    ...s.input,
                    width: "220px",
                    fontSize: "12px",
                    padding: "4px 8px",
                    background: "transparent",
                    border: "1px solid #1e293b",
                  }}
                />
                <span style={{ fontSize: "10px", color: "#475569" }}>
                  ⌘+Enter to save
                </span>
              </div>
              <button
                onClick={addNote}
                disabled={addingNote || !noteText.trim()}
                style={{
                  ...s.btnPrimary,
                  fontSize: "12px",
                  padding: "5px 14px",
                  opacity: addingNote || !noteText.trim() ? 0.4 : 1,
                }}
              >
                {addingNote ? "…" : "Add"}
              </button>
            </div>
          </div>

          {/* Notes list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                {editingNoteId === note.id ? (
                  <div>
                    <textarea
                      value={editNoteContent}
                      onChange={(e) => setEditNoteContent(e.target.value)}
                      rows={3}
                      style={{ ...s.textarea, marginBottom: "8px" }}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <input
                        value={editNoteContext}
                        onChange={(e) => setEditNoteContext(e.target.value)}
                        placeholder="context"
                        style={{
                          ...s.input,
                          width: "160px",
                          fontSize: "12px",
                          padding: "4px 8px",
                        }}
                      />
                      <button
                        onClick={() => updateNote(note.id)}
                        style={{
                          ...s.btnPrimary,
                          fontSize: "11px",
                          padding: "4px 12px",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        style={{
                          ...s.btnSecondary,
                          fontSize: "11px",
                          padding: "4px 10px",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        lineHeight: "1.6",
                        color: "#e2e8f0",
                        marginBottom: "6px",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {renderContent(note.content)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          fontSize: "11px",
                          color: "#475569",
                        }}
                      >
                        <span>{formatDate(note.entry_date)}</span>
                        {note.context && (
                          <span
                            style={{
                              padding: "1px 6px",
                              background: "#334155",
                              borderRadius: "4px",
                              fontSize: "10px",
                            }}
                          >
                            {note.context}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          opacity: 0.4,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "0.4")
                        }
                      >
                        <button
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditNoteContent(note.content);
                            setEditNoteContext(note.context || "");
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#64748b",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          edit
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#64748b",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {notes.length === 0 && (
              <div
                style={{
                  padding: "20px 0",
                  textAlign: "center",
                  color: "#475569",
                  fontSize: "13px",
                }}
              >
                No notes yet. Add your first note above — paste URLs, meeting
                notes, research, anything.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
