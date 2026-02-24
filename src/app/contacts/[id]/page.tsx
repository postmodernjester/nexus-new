"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Nav from "@/components/Nav";
import { unlinkContact } from "@/lib/connections";

import type {
  Contact,
  LinkedProfile,
  LinkedWorkEntry,
  LinkedChronicleEntry,
  LinkedEducationEntry,
  NoteEntry,
  ResumeData,
} from "./types";

import { formatDate, extractUrls, initials } from "./utils";
import { s } from "./styles";

import NotesSection from "./components/NotesSection";
import SynergySection from "./components/SynergySection";
import ResumeView from "./components/ResumeView";
import EditContactForm from "./components/EditContactForm";
import ResumeUploadModal from "./components/ResumeUploadModal";
import type { ParsedResumeData } from "./components/ResumeUploadModal";

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
  const [noteActionDue, setNoteActionDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [addingNote, setAddingNote] = useState(false);

  // Edit note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [editNoteDate, setEditNoteDate] = useState("");
  const [editNoteContext, setEditNoteContext] = useState("");
  const [editNoteAction, setEditNoteAction] = useState("");
  const [editNoteActionDue, setEditNoteActionDue] = useState("");
  const [editNoteActionCompleted, setEditNoteActionCompleted] = useState(false);

  // Unlink
  const [unlinking, setUnlinking] = useState(false);

  // AI summary
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [autoSummaryTriggered, setAutoSummaryTriggered] = useState(false);

  // Resume upload
  const [resumeUploadOpen, setResumeUploadOpen] = useState(false);

  // Edit scroll ref
  const editRef = useRef<HTMLDivElement>(null);

  // Snapshot linked profile data into resume_data so it persists after unlink
  function buildResumeSnapshot(
    profile: LinkedProfile | null,
    work: LinkedWorkEntry[],
    chronicle: LinkedChronicleEntry[],
    education: LinkedEducationEntry[],
  ): ResumeData {
    return {
      work: work.map((w) => ({
        title: w.title,
        company: w.company || "",
        location: w.location,
        engagement_type: w.engagement_type || undefined,
        start_date: w.start_date || undefined,
        end_date: w.end_date,
        is_current: w.is_current,
        description: w.description,
      })),
      education: education.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        field_of_study: e.field_of_study,
        start_date: e.start_date,
        end_date: e.end_date,
        is_current: e.is_current,
      })),
      profile: profile
        ? {
            full_name: profile.full_name,
            headline: profile.headline,
            bio: profile.bio,
            location: profile.location,
            website: profile.website,
            avatar_url: profile.avatar_url,
            key_links: profile.key_links,
            profile_photo_url: profile.profile_photo_url,
          }
        : undefined,
      chronicle: chronicle.length > 0 ? chronicle : undefined,
    };
  }

  async function saveResumeSnapshot(snapshot: ResumeData) {
    await supabase
      .from("contacts")
      .update({ resume_data: snapshot })
      .eq("id", cid);
    setContact((prev) => (prev ? { ...prev, resume_data: snapshot } : prev));
  }

  useEffect(() => {
    loadAll();
    // Re-fetch when switching back so action items stay in sync across pages
    // Skip if resume upload modal is open (prevents race with save)
    const onVisible = () => {
      if (document.visibilityState === "visible" && !resumeUploadOpen) loadAll();
    };
    const onFocus = () => {
      if (!resumeUploadOpen) loadAll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cid, resumeUploadOpen]);

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
          .select("id, title, company, engagement_type, start_date, end_date, is_current, description, location, show_on_resume")
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
          .select("id, institution, degree, field_of_study, start_date, end_date, is_current, show_on_resume")
          .eq("user_id", pid)
          .order("start_date", { ascending: false }),
      ]);
      // Filter out items where show_on_resume is explicitly false (null/undefined = visible)
      const filteredWork = workRes.data ? workRes.data.filter((w: any) => w.show_on_resume !== false) : [];
      const filteredEdu = eduRes.data ? eduRes.data.filter((e: any) => e.show_on_resume !== false) : [];
      const chronData = chronRes.data || [];
      setLinkedWork(filteredWork);
      setLinkedChronicle(chronData);
      setLinkedEducation(filteredEdu);

      // Snapshot linked data into resume_data so it persists if contact is later unlinked
      const currentProfile = profileRes.data || {
        full_name: contactRes.data.full_name,
        headline: contactRes.data.role ? [contactRes.data.role, contactRes.data.company].filter(Boolean).join(" at ") : null,
        bio: null,
        location: contactRes.data.location || null,
        website: null,
        avatar_url: contactRes.data.avatar_url || null,
        key_links: null,
        profile_photo_url: null,
      };
      const snapshot = buildResumeSnapshot(currentProfile, filteredWork, chronData, filteredEdu);
      // Fire-and-forget save — don't block page load
      supabase
        .from("contacts")
        .update({ resume_data: snapshot })
        .eq("id", cid)
        .then(() => {
          setContact((prev) => (prev ? { ...prev, resume_data: snapshot } : prev));
        });
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
    if (!noteText.trim() && !noteAction.trim()) return;
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
        content: noteText.trim() || noteAction.trim(),
        context: noteContext.trim() || null,
        entry_date: noteDate,
        action_text: noteAction.trim() || null,
        action_due_date: noteAction.trim() ? (noteActionDue || null) : null,
        action_completed: false,
      })
      .select()
      .single();

    if (error) {
      alert("Failed: " + error.message);
    } else if (data) {
      setNotes((prev) =>
        [data, ...prev].sort(
          (a, b) =>
            new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
        )
      );
      setNoteText("");
      setNoteContext("");
      setNoteAction("");
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setNoteActionDue(nextWeek.toISOString().split("T")[0]);
      setNoteDate(new Date().toISOString().split("T")[0]);
      touchContactUpdatedAt();
    }
    setAddingNote(false);
  }

  async function updateNote(id: string) {
    const { data, error } = await supabase
      .from("contact_notes")
      .update({
        content: editNoteContent,
        context: editNoteContext || null,
        entry_date: editNoteDate,
        action_text: editNoteAction || null,
        action_due_date: editNoteActionDue || null,
        action_completed: editNoteActionCompleted,
      })
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      alert("Failed: " + (error?.message || "Update not applied — check permissions"));
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
    // Optimistically update local state first
    setNotes((prev) =>
      prev.map((n) =>
        n.id === note.id ? { ...n, action_completed: newVal } : n
      )
    );
    const { data, error } = await supabase
      .from("contact_notes")
      .update({ action_completed: newVal })
      .eq("id", note.id)
      .select()
      .single();
    if (error || !data) {
      // Revert on failure (includes RLS silent denial)
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id ? { ...n, action_completed: !newVal } : n
        )
      );
      console.error("Failed to toggle action:", error || "No rows updated");
    } else {
      touchContactUpdatedAt();
    }
  }

  async function toggleImportance(note: NoteEntry) {
    const cycle = [null, "green", "yellow", "red"] as const;
    const idx = cycle.indexOf(note.importance as any);
    const next = cycle[(idx + 1) % cycle.length];
    const prev = note.importance;
    setNotes((prevNotes) =>
      prevNotes.map((n) =>
        n.id === note.id ? { ...n, importance: next } : n
      )
    );
    const { data, error } = await supabase
      .from("contact_notes")
      .update({ importance: next })
      .eq("id", note.id)
      .select()
      .single();
    if (error || !data) {
      // Revert on failure
      setNotes((prevNotes) =>
        prevNotes.map((n) =>
          n.id === note.id ? { ...n, importance: prev } : n
        )
      );
      console.error("Failed to toggle importance:", error || "No rows updated");
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("contact_notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    touchContactUpdatedAt();
  }

  async function handleUnlink() {
    if (!contact?.linked_profile_id || !userId) return;
    if (!confirm(`Unlink from ${contact.full_name}? The contact card and your notes will be kept. Their resume data will be preserved as a snapshot.`)) return;
    setUnlinking(true);

    // Snapshot current linked data into resume_data before unlinking
    const snapshot = buildResumeSnapshot(linkedProfile, linkedWork, linkedChronicle, linkedEducation);
    await saveResumeSnapshot(snapshot);

    const result = await unlinkContact(userId, cid, contact.linked_profile_id, contact.full_name);
    if (result.success) {
      setContact(prev => prev ? { ...prev, linked_profile_id: null, resume_data: snapshot } : prev);
      setLinkedProfile(null);
      setLinkedWork([]);
      setLinkedChronicle([]);
      setLinkedEducation([]);
      // Refresh notes to show the unlink activity entry
      const { data: freshNotes } = await supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", cid)
        .order("entry_date", { ascending: false });
      if (freshNotes) setNotes(freshNotes);
    } else {
      alert("Failed to unlink: " + (result.error || "Unknown error"));
    }
    setUnlinking(false);
  }

  async function deleteContact() {
    if (!confirm("Delete " + contact?.full_name + "?")) return;
    // If linked, unlink first (cleans up both sides)
    if (contact?.linked_profile_id && userId) {
      await unlinkContact(userId, cid, contact.linked_profile_id, contact.full_name);
    }
    // Clean up any connection records referencing this contact
    await supabase.from("connections").delete().eq("contact_id", cid);
    // Delete notes then contact
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

  async function handleResumeParsed(data: ParsedResumeData) {
    setResumeUploadOpen(false);
    // Preserve any existing snapshot profile/chronicle data when merging with uploaded work/edu
    const resumeData: ResumeData = {
      work: data.work,
      education: data.education,
      raw_text: data.raw_text,
      profile: contact?.resume_data?.profile,
      chronicle: contact?.resume_data?.chronicle,
    };
    // Save to DB
    const { error } = await supabase
      .from("contacts")
      .update({ resume_data: resumeData })
      .eq("id", cid);
    if (error) {
      console.error("Failed to save resume data:", error);
      alert("Failed to save resume: " + error.message);
      return;
    }
    setContact((prev) => prev ? { ...prev, resume_data: resumeData } : prev);
  }

  async function handleClearResume() {
    await supabase
      .from("contacts")
      .update({ resume_data: null })
      .eq("id", cid);
    setContact((prev) => prev ? { ...prev, resume_data: null } : prev);
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
          <div />

          <div style={{ display: "flex", gap: "8px" }}>
            {linkedProfile ? (
              <button
                onClick={handleUnlink}
                disabled={unlinking}
                style={{
                  ...s.btnSecondary,
                  background: "rgba(96,165,250,0.15)",
                  border: "1px solid rgba(96,165,250,0.3)",
                  color: "#60a5fa",
                  opacity: unlinking ? 0.5 : 1,
                }}
              >
                {unlinking ? "Unlinking…" : "Linked"}
              </button>
            ) : userId ? (
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
                {copiedLink ? "Link Copied!" : "Link"}
              </button>
            ) : null}
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
          addNote={addNote}
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
          toggleImportance={toggleImportance}
        />

        {/* SYNERGY */}
        <SynergySection
          contact={contact}
          linkedProfile={linkedProfile}
          linkedWork={linkedWork}
          linkedChronicle={linkedChronicle}
          linkedEducation={linkedEducation}
        />

        {/* RESUME VIEW — shown for linked contacts, or contacts with parsed resume data */}
        {(linkedProfile || contact.resume_data) && (
          <ResumeView
            linkedProfile={linkedProfile}
            linkedWork={linkedWork}
            linkedChronicle={linkedChronicle}
            linkedEducation={linkedEducation}
            contact={contact}
            parsedResume={contact.resume_data}
            onUploadResume={() => setResumeUploadOpen(true)}
            onClearResume={handleClearResume}
          />
        )}

        {/* Upload resume button when no linked profile and no parsed data */}
        {!linkedProfile && !contact.resume_data && (
          <div style={{ ...s.card, textAlign: "center" as const }}>
            <div style={{ ...s.sectionLabel, marginBottom: 8 }}>Resume</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
              Upload a PDF or paste from LinkedIn to build a resume for this contact.
            </div>
            <button
              onClick={() => setResumeUploadOpen(true)}
              style={s.btnPrimary}
            >
              Upload Resume
            </button>
          </div>
        )}

        {/* Resume Upload Modal */}
        <ResumeUploadModal
          open={resumeUploadOpen}
          personName={contact.full_name}
          onClose={() => setResumeUploadOpen(false)}
          onParsed={handleResumeParsed}
        />

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
                  checked={n.action_completed}
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
