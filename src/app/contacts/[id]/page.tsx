"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

import Nav from "@/components/Nav";

import type {
  Contact,
  LinkedProfile,
  LinkedWorkEntry,
  LinkedChronicleEntry,
  LinkedEducationEntry,
  NoteEntry,
} from "./types";

import { formatDate, extractUrls, initials } from "./utils";
import { s } from "./styles";

import NotesSection from "./components/NotesSection";
import SynergySection from "./components/SynergySection";
import ResumeView from "./components/ResumeView";
import EditContactForm from "./components/EditContactForm";

export default function ContactDossierPage() {
  const router = useRouter();
  const params = useParams();
  const cid = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [linkedProfile, setLinkedProfile] = useState<LinkedProfile | null>(
    null
  );
  const [linkedWork, setLinkedWork] = useState<LinkedWorkEntry[]>([]);
  const [linkedChronicle, setLinkedChronicle] = useState<LinkedChronicleEntry[]>([]);
  const [linkedEducation, setLinkedEducation] = useState<LinkedEducationEntry[]>([]);
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
  const [autoSummaryTriggered, setAutoSummaryTriggered] = useState(false);

  // Edit scroll ref
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAll();
  }, [cid]);

  // Touch contact's updated_at so "Recent" sort reflects note activity
  async function touchContactUpdatedAt() {
    await supabase
      .from("contacts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cid);
  }

  // Auto-generate dossier for linked contacts that don't have one yet
  useEffect(() => {
    if (
      !loading &&
      contact &&
      contact.linked_profile_id &&
      !contact.ai_summary &&
      linkedProfile &&
      !autoSummaryTriggered &&
      !generatingSummary
    ) {
      setAutoSummaryTriggered(true);
      generateAISummary();
    }
  }, [loading, contact, linkedProfile, autoSummaryTriggered, generatingSummary]);

  // Scroll to edit form when opened
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [editing]);

  async function loadAll() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUserId(user.id);

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
      const pid = contactRes.data.linked_profile_id;
      // Fetch each independently so one failure doesn't block others
      const profileRes = await supabase
        .from("profiles")
        .select("full_name, headline, bio, location, website, avatar_url, key_links, profile_photo_url")
        .eq("id", pid)
        .single();

      // Use profile data if available, otherwise build a minimal one from the contact
      if (profileRes.data) {
        setLinkedProfile(profileRes.data);
      } else {
        setLinkedProfile({
          full_name: contactRes.data.full_name,
          headline: contactRes.data.role ? [contactRes.data.role, contactRes.data.company].filter(Boolean).join(" at ") : null,
          bio: null,
          location: contactRes.data.location || null,
          website: null,
          avatar_url: contactRes.data.avatar_url || null,
          key_links: null,
          profile_photo_url: null,
        });
      }

      const [workRes, chronRes, eduRes] = await Promise.all([
        supabase
          .from("work_entries")
          .select("id, title, company, engagement_type, start_date, end_date, is_current, description, location")
          .eq("user_id", pid)
          .order("is_current", { ascending: false })
          .order("start_date", { ascending: false }),
        supabase
          .from("chronicle_entries")
          .select("*")
          .eq("user_id", pid)
          .eq("show_on_resume", true)
          .order("start_date", { ascending: false }),
        supabase
          .from("education")
          .select("id, institution, degree, field_of_study, start_date, end_date, is_current")
          .eq("user_id", pid)
          .order("start_date", { ascending: false }),
      ]);
      if (workRes.data) setLinkedWork(workRes.data);
      if (chronRes.data) setLinkedChronicle(chronRes.data);
      if (eduRes.data) setLinkedEducation(eduRes.data);
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
      touchContactUpdatedAt();
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
      touchContactUpdatedAt();
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
    touchContactUpdatedAt();
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("contact_notes").delete().eq("id", id);
    setNotes(notes.filter((n) => n.id !== id));
    touchContactUpdatedAt();
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
      ...(linkedProfile?.key_links
        ? linkedProfile.key_links
            .filter(l => l.url && l.visible)
            .map(l => `Their ${l.type}: ${l.url}`)
        : []),
    ]
      .filter(Boolean)
      .join("\n");

    // Collect URLs: key_links first (most authoritative), then note URLs
    const keyLinkUrls = (linkedProfile?.key_links || [])
      .filter((l) => l.url && l.visible)
      .map((l) => l.url);
    const noteUrls: string[] = [];
    for (const n of notes) {
      noteUrls.push(...extractUrls(n.content));
    }
    const uniqueUrls = [...new Set([...keyLinkUrls, ...noteUrls])];

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
            {!linkedProfile && userId && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/connect/${userId}?contact=${cid}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                style={{
                  ...s.btnSecondary,
                  background: copiedLink ? "rgba(96,165,250,0.2)" : undefined,
                  color: copiedLink ? "#60a5fa" : undefined,
                }}
              >
                {copiedLink ? "Copied!" : "Copy Invite Link"}
              </button>
            )}
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

        {/* HEADER */}
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

        {/* EDIT CONTACT FIELDS */}
        {editing && (
          <div ref={editRef}>
            <EditContactForm
              editFields={editFields}
              setField={setField}
              saving={saving}
              saveContact={saveContact}
              onCancel={() => {
                setEditing(false);
                setEditFields(contact);
              }}
            />
          </div>
        )}

        {/* AI SUMMARY */}
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

        {/* NOTES & RESEARCH */}
        <NotesSection
          notes={notes}
          noteText={noteText}
          setNoteText={setNoteText}
          noteDate={noteDate}
          setNoteDate={setNoteDate}
          noteContext={noteContext}
          setNoteContext={setNoteContext}
          noteAction={noteAction}
          setNoteAction={setNoteAction}
          noteActionDue={noteActionDue}
          setNoteActionDue={setNoteActionDue}
          addingNote={addingNote}
          showActionFields={showActionFields}
          setShowActionFields={setShowActionFields}
          addNote={addNote}
          handleNoteKeyDown={handleNoteKeyDown}
          editingNoteId={editingNoteId}
          setEditingNoteId={setEditingNoteId}
          editNoteContent={editNoteContent}
          setEditNoteContent={setEditNoteContent}
          editNoteDate={editNoteDate}
          setEditNoteDate={setEditNoteDate}
          editNoteContext={editNoteContext}
          setEditNoteContext={setEditNoteContext}
          editNoteAction={editNoteAction}
          setEditNoteAction={setEditNoteAction}
          editNoteActionDue={editNoteActionDue}
          setEditNoteActionDue={setEditNoteActionDue}
          editNoteActionCompleted={editNoteActionCompleted}
          setEditNoteActionCompleted={setEditNoteActionCompleted}
          updateNote={updateNote}
          toggleAction={toggleAction}
          deleteNote={deleteNote}
        />

        {/* SYNERGY */}
        <SynergySection
          contact={contact}
          linkedProfile={linkedProfile}
          linkedWork={linkedWork}
          linkedChronicle={linkedChronicle}
          linkedEducation={linkedEducation}
        />

        {/* RESUME VIEW */}
        {linkedProfile && (
          <ResumeView
            linkedProfile={linkedProfile}
            linkedWork={linkedWork}
            linkedChronicle={linkedChronicle}
            linkedEducation={linkedEducation}
            contact={contact}
          />
        )}

        {/* PENDING ACTIONS */}
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

      </div>
    </div>
  );
}
