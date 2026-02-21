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
  follow_up_status: string | null;
  last_contact_date: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
  ai_summary: string | null;
  how_we_met: string | null;
  met_date: string | null;
  avatar_url: string | null;
  show_on_chronicle: boolean;
  created_at: string;
}

interface LinkedProfile {
  full_name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar_url: string | null;
}

interface LinkedWorkEntry {
  id: string;
  title: string;
  company: string | null;
  engagement_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  location: string | null;
}

interface NoteEntry {
  id: string;
  contact_id: string;
  owner_id: string;
  content: string;
  context: string | null;
  entry_date: string;
  action_text: string | null;
  action_due_date: string | null;
  action_completed: boolean;
  created_at: string;
}

const REL_TYPES = [
  "None",
  "Acquaintance",
  "Business Contact",
  "Work-Friend",
  "Close Friend",
  "Family",
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatWorkDate(d: string) {
  if (!d) return "";
  const parts = d.split("-");
  const year = parts[0] || "";
  const month = parts[1] ? parseInt(parts[1]) : 0;
  if (!year) return "";
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!month) return year;
  return `${months[month]} ${year}`;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// Detect URLs in text and render as clickable links
function renderContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//)) {
      let domain = "";
      try {
        domain = new URL(part).hostname.replace("www.", "");
      } catch {
        domain = part;
      }
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

// Extract URLs from text
function extractUrls(text: string): string[] {
  const matches = text.match(/(https?:\/\/[^\s<]+)/g);
  return matches || [];
}

// ─── Styles ───
const s = {
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
    boxSizing: "border-box" as const,
  },
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
    boxSizing: "border-box" as const,
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "14px",
    outline: "none",
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
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
  sectionLabel: {
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "12px",
  },
};

export default function ContactDossierPage() {
  const router = useRouter();
  const params = useParams();
  const cid = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [linkedProfile, setLinkedProfile] = useState<LinkedProfile | null>(
    null
  );
  const [linkedWork, setLinkedWork] = useState<LinkedWorkEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);

  // New note
  const [noteText, setNoteText] = useState("");
  const [noteDate, setNoteDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [noteContext, setNoteContext] = useState("");
  const [noteAction, setNoteAction] = useState("");
  const [noteActionDue, setNoteActionDue] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showActionFields, setShowActionFields] = useState(false);

  // Edit note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [editNoteDate, setEditNoteDate] = useState("");
  const [editNoteContext, setEditNoteContext] = useState("");
  const [editNoteAction, setEditNoteAction] = useState("");
  const [editNoteActionDue, setEditNoteActionDue] = useState("");
  const [editNoteActionCompleted, setEditNoteActionCompleted] = useState(false);

  // AI summary
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    loadAll();
  }, [cid]);

  async function loadAll() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const [contactRes, notesRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("*")
        .eq("id", cid)
        .eq("owner_id", user.id)
        .single(),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", cid)
        .order("entry_date", { ascending: false }),
    ]);

    if (!contactRes.data) {
      router.push("/contacts");
      return;
    }

    setContact(contactRes.data);
    setEditFields(contactRes.data);
    setNotes(notesRes.data || []);

    if (contactRes.data.linked_profile_id) {
      const [profileRes, workRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, headline, bio, location, website, avatar_url")
          .eq("id", contactRes.data.linked_profile_id)
          .single(),
        supabase
          .from("work_entries")
          .select("id, title, company, engagement_type, start_date, end_date, is_current, description, location")
          .eq("user_id", contactRes.data.linked_profile_id)
          .order("is_current", { ascending: false })
          .order("start_date", { ascending: false }),
      ]);
      if (profileRes.data) setLinkedProfile(profileRes.data);
      if (workRes.data) setLinkedWork(workRes.data);
    }

    setLoading(false);
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
        follow_up_status: editFields.follow_up_status || null,
        last_contact_date: editFields.last_contact_date || null,
        next_action_date: editFields.next_action_date || null,
        next_action_note: editFields.next_action_note || null,
        show_on_chronicle: editFields.show_on_chronicle || false,
        met_date: editFields.met_date || null,
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
        entry_date: noteDate,
        action_text: noteAction.trim() || null,
        action_due_date: noteActionDue || null,
        action_completed: false,
      })
      .select()
      .single();

    if (error) {
      alert("Failed: " + error.message);
    } else if (data) {
      setNotes(
        [data, ...notes].sort(
          (a, b) =>
            new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
        )
      );
      setNoteText("");
      setNoteContext("");
      setNoteAction("");
      setNoteActionDue("");
      setShowActionFields(false);
      setNoteDate(new Date().toISOString().split("T")[0]);
    }
    setAddingNote(false);
  }

  async function updateNote(id: string) {
    const { error } = await supabase
      .from("contact_notes")
      .update({
        content: editNoteContent,
        context: editNoteContext || null,
        entry_date: editNoteDate,
        action_text: editNoteAction || null,
        action_due_date: editNoteActionDue || null,
        action_completed: editNoteActionCompleted,
      })
      .eq("id", id);
    if (error) {
      alert("Failed: " + error.message);
    } else {
      const updated = notes
        .map((n) =>
          n.id === id
            ? {
                ...n,
                content: editNoteContent,
                context: editNoteContext || null,
                entry_date: editNoteDate,
                action_text: editNoteAction || null,
                action_due_date: editNoteActionDue || null,
                action_completed: editNoteActionCompleted,
              }
            : n
        )
        .sort(
          (a, b) =>
            new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
        );
      setNotes(updated);
      setEditingNoteId(null);
    }
  }

  async function toggleAction(note: NoteEntry) {
    const newVal = !note.action_completed;
    await supabase
      .from("contact_notes")
      .update({ action_completed: newVal })
      .eq("id", note.id);
    setNotes(
      notes.map((n) =>
        n.id === note.id ? { ...n, action_completed: newVal } : n
      )
    );
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("contact_notes").delete().eq("id", id);
    setNotes(notes.filter((n) => n.id !== id));
  }

  async function deleteContact() {
    if (!confirm("Delete " + contact?.full_name + "?")) return;
    await supabase.from("contact_notes").delete().eq("contact_id", cid);
    await supabase.from("contacts").delete().eq("id", cid);
    router.push("/contacts");
  }

  async function generateAISummary() {
    setGeneratingSummary(true);

    // Gather all context
    const allNoteTexts = notes
      .map((n) => {
        let line = `[${n.entry_date}] ${n.content}`;
        if (n.action_text) line += ` [Action: ${n.action_text}]`;
        return line;
      })
      .join("\n");

    const contactInfo = [
      contact?.full_name && `Name: ${contact.full_name}`,
      contact?.role && `Role: ${contact.role}`,
      contact?.company && `Company: ${contact.company}`,
      contact?.location && `Location: ${contact.location}`,
      contact?.email && `Email: ${contact.email}`,
      contact?.relationship_type &&
        `Relationship: ${contact.relationship_type}`,
      linkedProfile?.headline &&
        `Their self-described headline: ${linkedProfile.headline}`,
      linkedProfile?.bio && `Their bio: ${linkedProfile.bio}`,
      linkedProfile?.location &&
        `Their location: ${linkedProfile.location}`,
      linkedProfile?.website && `Their website: ${linkedProfile.website}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Extract URLs from all notes
    const allUrls: string[] = [];
    for (const n of notes) {
      allUrls.push(...extractUrls(n.content));
    }
    // Deduplicate
    const uniqueUrls = [...new Set(allUrls)];

    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactInfo,
          notes: allNoteTexts,
          urls: uniqueUrls,
        }),
      });

      if (!response.ok) {
        throw new Error("API returned " + response.status);
      }

      const data = await response.json();
      const summary = data.summary || "";
      const oneliner = data.oneliner || "";

    if (summary) {
        await supabase
          .from("contacts")
          .update({ ai_summary: summary, mini_summary: oneliner || null })
          .eq("id", cid);
        setContact((prev) =>
          prev ? { ...prev, ai_summary: summary } : prev
        );
      }
    } catch (e: any) {
      console.error("AI summary error:", e);
      alert("Failed to generate summary: " + (e.message || "Unknown error"));
    }

    setGeneratingSummary(false);
  }

  function handleNoteKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      addNote();
    }
  }

  const setField = (k: string, v: string | boolean) =>
    setEditFields({ ...editFields, [k]: v });

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a" }}>
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

  // Pending actions across all notes
  const pendingActions = notes.filter(
    (n) => n.action_text && !n.action_completed
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <Nav />

      <div
        style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 20px 60px" }}
      >
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
              <button onClick={() => setEditing(true)} style={s.btnSecondary}>
                Edit
              </button>
            )}
            <button onClick={deleteContact} style={s.btnDanger}>
              Delete
            </button>
          </div>
        </div>

        {/* ═══ HEADER ═══ */}
        <div
          style={{
            ...s.card,
            display: "flex",
            gap: "16px",
            alignItems: "flex-start",
          }}
        >
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
              overflow: "hidden",
            }}
          >
            {contact.avatar_url || linkedProfile?.avatar_url ? (
              <img
                src={linkedProfile?.avatar_url || contact.avatar_url || ""}
                alt=""
                style={{
                  width: "64px",
                  height: "64px",
                  objectFit: "cover",
                }}
              />
            ) : (
              initials(linkedProfile?.full_name || contact.full_name)
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>
              {linkedProfile?.full_name || contact.full_name}
            </h1>
            {(linkedProfile?.headline || contact.role || contact.company) && (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "14px",
                  marginTop: "2px",
                }}
              >
                {linkedProfile?.headline || [contact.role, contact.company].filter(Boolean).join(" · ")}
              </div>
            )}
            {contact.location && (
              <div
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                  marginTop: "2px",
                }}
              >
                {contact.location}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "8px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
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
                  style={{
                    fontSize: "12px",
                    color: "#60a5fa",
                    textDecoration: "none",
                  }}
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
            <span style={s.sectionLabel}>Dossier Summary</span>
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
              Add notes below — paste LinkedIn URLs, Wikipedia pages, articles,
              meeting notes — then click Generate. The AI will read the linked
              pages and synthesize a professional summary.
            </p>
          )}
        </div>

        {/* ═══ LINKED PROFILE ═══ */}
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
                gap: "8px 16px",
                fontSize: "13px",
              }}
            >
              {linkedProfile.headline && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b" }}>Headline: </span>
                  <span>{linkedProfile.headline}</span>
                </div>
              )}
              {linkedProfile.bio && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b" }}>Bio: </span>
                  <span>{linkedProfile.bio}</span>
                </div>
              )}
              {linkedProfile.location && (
                <div>
                  <span style={{ color: "#64748b" }}>Location: </span>
                  <span>{linkedProfile.location}</span>
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
                    {(() => {
                      try {
                        return new URL(linkedProfile.website!).hostname.replace("www.", "");
                      } catch {
                        return linkedProfile.website;
                      }
                    })()}
                    <span style={{ fontSize: "10px", marginLeft: "3px" }}>↗</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ LINKED WORK ENTRIES ═══ */}
        {linkedWork.length > 0 && (
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
                marginBottom: "14px",
              }}
            >
              Experience (from their resume)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {linkedWork.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: "12px 14px",
                    background: "rgba(15,23,42,0.5)",
                    borderRadius: "8px",
                    border: "1px solid #1e293b",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>
                    {entry.title}
                  </div>
                  {(entry.company || entry.engagement_type) && (
                    <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "2px" }}>
                      {entry.company}
                      {entry.engagement_type && entry.engagement_type !== "full-time"
                        ? ` · ${entry.engagement_type}`
                        : ""}
                    </div>
                  )}
                  <div style={{ color: "#64748b", fontSize: "12px", marginTop: "2px" }}>
                    {formatWorkDate(entry.start_date || "")}{" "}
                    – {entry.is_current ? "Present" : formatWorkDate(entry.end_date || "")}
                    {entry.location ? ` · ${entry.location}` : ""}
                  </div>
                  {entry.description && (
                    <p
                      style={{
                        color: "#cbd5e1",
                        fontSize: "13px",
                        marginTop: "8px",
                        lineHeight: "1.5",
                        whiteSpace: "pre-wrap",
                        margin: "8px 0 0",
                      }}
                    >
                      {entry.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PENDING ACTIONS ═══ */}
        {pendingActions.length > 0 && (
          <div
            style={{
              ...s.card,
              borderColor: "rgba(251,191,36,0.3)",
              background: "rgba(30,41,59,0.7)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#fbbf24",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "10px",
              }}
            >
              Open Actions
            </div>
            {pendingActions.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "8px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleAction(n)}
                  style={{ marginTop: "3px", cursor: "pointer", accentColor: "#a78bfa" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px" }}>{n.action_text}</div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: n.action_due_date &&
                        new Date(n.action_due_date) < new Date()
                        ? "#f87171"
                        : "#64748b",
                      marginTop: "2px",
                    }}
                  >
                    {n.action_due_date
                      ? `Due ${formatDate(n.action_due_date)}`
                      : "No due date"}
                    {" · "}
                    from {formatDate(n.entry_date)} note
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ EDIT CONTACT FIELDS ═══ */}
        {editing && (
          <div style={s.card}>
            <div style={s.sectionLabel}>Edit Contact</div>
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
                />
              </div>
              <div>
                <label style={s.label}>Relationship</label>
                <select
                  style={s.select}
                  value={editFields.relationship_type || "Acquaintance"}
                  onChange={(e) =>
                    setField("relationship_type", e.target.value)
                  }
                >
                  {REL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Last Contact</label>
                <input
                  style={s.input}
                  type="date"
                  value={editFields.last_contact_date || ""}
                  onChange={(e) =>
                    setField("last_contact_date", e.target.value)
                  }
                />
              </div>
              <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #334155", paddingTop: "12px", marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editFields.show_on_chronicle || false}
                    onChange={(e) => setField("show_on_chronicle", e.target.checked)}
                    style={{ width: "14px", height: "14px", accentColor: "#a78bfa" }}
                  />
                  <span style={{ fontSize: "13px", color: "#e2e8f0" }}>Show on Chronicle</span>
                </label>
              </div>
              {editFields.show_on_chronicle && (
                <div>
                  <label style={s.label}>Chronicle Start Date</label>
                  <input
                    style={s.input}
                    type="date"
                    value={editFields.met_date || ""}
                    onChange={(e) => setField("met_date", e.target.value)}
                    placeholder="When they entered the story"
                  />
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                    When this person entered your story (defaults to card creation date)
                  </div>
                </div>
              )}
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

        {/* ═══ NOTES & RESEARCH ═══ */}
        <div style={s.card}>
          <div style={s.sectionLabel}>Notes & Research</div>

          {/* Add note */}
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
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleNoteKeyDown}
              placeholder="Add a note, paste a URL, meeting notes, research…"
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
                padding: "8px 12px",
                borderTop: "1px solid #1e293b",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  style={{
                    ...s.input,
                    width: "140px",
                    fontSize: "12px",
                    padding: "4px 8px",
                    background: "transparent",
                    border: "1px solid #1e293b",
                  }}
                />
                <input
                  value={noteContext}
                  onChange={(e) => setNoteContext(e.target.value)}
                  placeholder="context (meeting, call, research…)"
                  style={{
                    ...s.input,
                    width: "200px",
                    fontSize: "12px",
                    padding: "4px 8px",
                    background: "transparent",
                    border: "1px solid #1e293b",
                  }}
                />
                <button
                  onClick={() => setShowActionFields(!showActionFields)}
                  style={{
                    ...s.btnSecondary,
                    fontSize: "11px",
                    padding: "3px 10px",
                    color: showActionFields ? "#a78bfa" : "#64748b",
                    borderColor: showActionFields ? "#a78bfa" : "#334155",
                  }}
                >
                  + Action
                </button>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#475569" }}>
                    ⌘+Enter
                  </span>
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

              {showActionFields && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 0",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Action:
                  </span>
                  <input
                    value={noteAction}
                    onChange={(e) => setNoteAction(e.target.value)}
                    placeholder="Follow up, send proposal, schedule call…"
                    style={{
                      ...s.input,
                      flex: 1,
                      fontSize: "12px",
                      padding: "4px 8px",
                      background: "transparent",
                      border: "1px solid #1e293b",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Due:
                  </span>
                  <input
                    type="date"
                    value={noteActionDue}
                    onChange={(e) => setNoteActionDue(e.target.value)}
                    style={{
                      ...s.input,
                      width: "140px",
                      fontSize: "12px",
                      padding: "4px 8px",
                      background: "transparent",
                      border: "1px solid #1e293b",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes list */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                {editingNoteId === note.id ? (
                  /* Edit mode */
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <textarea
                      value={editNoteContent}
                      onChange={(e) => setEditNoteContent(e.target.value)}
                      rows={3}
                      style={s.textarea}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="date"
                        value={editNoteDate}
                        onChange={(e) => setEditNoteDate(e.target.value)}
                        style={{
                          ...s.input,
                          width: "140px",
                          fontSize: "12px",
                          padding: "4px 8px",
                        }}
                      />
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
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        Action:
                      </span>
                      <input
                        value={editNoteAction}
                        onChange={(e) => setEditNoteAction(e.target.value)}
                        placeholder="action item"
                        style={{
                          ...s.input,
                          flex: 1,
                          fontSize: "12px",
                          padding: "4px 8px",
                        }}
                      />
                      <input
                        type="date"
                        value={editNoteActionDue}
                        onChange={(e) => setEditNoteActionDue(e.target.value)}
                        style={{
                          ...s.input,
                          width: "140px",
                          fontSize: "12px",
                          padding: "4px 8px",
                        }}
                      />
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          color: "#64748b",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editNoteActionCompleted}
                          onChange={(e) =>
                            setEditNoteActionCompleted(e.target.checked)
                          }
                          style={{ accentColor: "#a78bfa" }}
                        />
                        Done
                      </label>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop: "4px",
                      }}
                    >
                      <button
                        onClick={() => updateNote(note.id)}
                        style={{
                          ...s.btnPrimary,
                          fontSize: "11px",
                          padding: "5px 14px",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        style={{
                          ...s.btnSecondary,
                          fontSize: "11px",
                          padding: "5px 12px",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Read mode */
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        lineHeight: "1.6",
                        color: "#e2e8f0",
                        whiteSpace: "pre-wrap",
                        marginBottom: "6px",
                      }}
                    >
                      {renderContent(note.content)}
                    </div>

                    {/* Action item */}
                    {note.action_text && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          margin: "8px 0",
                          padding: "8px 12px",
                          background: note.action_completed
                            ? "rgba(16,185,129,0.08)"
                            : "rgba(251,191,36,0.08)",
                          borderRadius: "6px",
                          border: `1px solid ${note.action_completed ? "rgba(16,185,129,0.2)" : "rgba(251,191,36,0.2)"}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={note.action_completed}
                          onChange={() => toggleAction(note)}
                          style={{
                            marginTop: "2px",
                            cursor: "pointer",
                            accentColor: "#a78bfa",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <span
                            style={{
                              fontSize: "13px",
                              textDecoration: note.action_completed
                                ? "line-through"
                                : "none",
                              color: note.action_completed
                                ? "#64748b"
                                : "#e2e8f0",
                            }}
                          >
                            {note.action_text}
                          </span>
                          {note.action_due_date && (
                            <span
                              style={{
                                fontSize: "11px",
                                marginLeft: "10px",
                                color:
                                  !note.action_completed &&
                                  new Date(note.action_due_date) < new Date()
                                    ? "#f87171"
                                    : "#64748b",
                              }}
                            >
                              due {formatDate(note.action_due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Meta row */}
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
                          opacity: 0.3,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "0.3")
                        }
                      >
                        <button
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditNoteContent(note.content);
                            setEditNoteDate(note.entry_date);
                            setEditNoteContext(note.context || "");
                            setEditNoteAction(note.action_text || "");
                            setEditNoteActionDue(note.action_due_date || "");
                            setEditNoteActionCompleted(note.action_completed);
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
                  padding: "24px 0",
                  textAlign: "center",
                  color: "#475569",
                  fontSize: "13px",
                  lineHeight: "1.6",
                }}
              >
                No notes yet. Paste LinkedIn profiles, Wikipedia pages, articles,
                meeting notes — anything.
                <br />
                The AI summary reads linked pages and synthesizes a profile.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
