"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrCreateInviteCode } from "@/lib/connections";
import Link from "next/link";
import Nav from "@/components/Nav";

interface Profile {
  id: string;
  full_name: string;
  headline: string;
  avatar_url: string;
  profile_photo_url: string | null;
}

interface ActionItem {
  id: string;
  action_text: string;
  action_due_date: string | null;
  action_completed: boolean;
  importance: string | null;
  entry_date: string;
  contact_id: string;
  contact_name: string;
  contact_company: string | null;
}

interface RecentNote {
  id: string;
  content: string;
  context: string | null;
  entry_date: string;
  contact_id: string;
  contact_name: string;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  from_user_id: string;
  from_name: string;
  from_headline: string | null;
  created_at: string;
}

interface LinkedConnection {
  contact_id: string;
  contact_name: string;
  profile_id: string;
  updated_at: string;
  headline: string | null;
}

interface ContactOption {
  id: string;
  full_name: string;
}

// SVG ring chart component
function RingChart({
  segments,
  size = 80,
  stroke = 8,
  label,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  label: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={stroke}
        />
        {total > 0 &&
          segments.map((seg, i) => {
            const dashLen = (seg.value / total) * circumference;
            const dashOffset = -offset;
            offset += dashLen;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            );
          })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "18px", fontWeight: "bold", color: "#e2e8f0" }}>
          {total}
        </span>
        <span style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// Small horizontal bar
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: "4px", background: "#1e293b", borderRadius: "2px", flex: 1 }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "2px",
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);
  const [networkSize, setNetworkSize] = useState(0);
  const [linkedConnections, setLinkedConnections] = useState<LinkedConnection[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [allContacts, setAllContacts] = useState<ContactOption[]>([]);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDue, setEditDue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  // New action item state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newContactId, setNewContactId] = useState("");
  const [newActionText, setNewActionText] = useState("");
  const [newActionDue, setNewActionDue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    window.addEventListener("popstate", load);
    load();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
      window.removeEventListener("popstate", load);
    };
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const [profileRes, contactsRes, connectionsRes, notesRes, invitationsRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, headline, avatar_url, profile_photo_url")
            .eq("id", user.id)
            .single(),
          supabase
            .from("contacts")
            .select("id, full_name, linked_profile_id, company")
            .eq("owner_id", user.id),
          supabase
            .from("connections")
            .select("id, inviter_id, invitee_id")
            .eq("status", "accepted")
            .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`),
          supabase
            .from("contact_notes")
            .select("id, content, context, entry_date, contact_id, action_text, action_due_date, action_completed, importance, created_at")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("link_invitations")
            .select("id, from_user_id, created_at")
            .eq("to_user_id", user.id)
            .eq("status", "pending"),
        ]);

      setProfile(profileRes.data as Profile);
      const contactsList = (contactsRes.data || []) as { id: string; full_name: string; linked_profile_id: string | null; company: string | null }[];
      setTotalContacts(contactsList.length);
      setAllContacts(
        contactsList
          .map((c) => ({ id: c.id, full_name: c.full_name }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      );
      const connectionsList = (connectionsRes.data || []) as { id: string; inviter_id: string; invitee_id: string }[];
      setConnectionCount(connectionsList.length);

      const connectedUserIds = connectionsList.map((c) =>
        c.inviter_id === user.id ? c.invitee_id : c.inviter_id
      );

      const linkedProfileIds = contactsList
        .filter((c) => c.linked_profile_id)
        .map((c) => c.linked_profile_id!);

      if (linkedProfileIds.length > 0) {
        const { data: linkedProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, headline, updated_at")
          .in("id", linkedProfileIds);

        if (linkedProfiles) {
          const profileToContact = new Map<string, { contact_id: string; contact_name: string }>();
          contactsList.forEach((c) => {
            if (c.linked_profile_id) {
              profileToContact.set(c.linked_profile_id, { contact_id: c.id, contact_name: c.full_name });
            }
          });

          const linked: LinkedConnection[] = linkedProfiles
            .map((p: any) => {
              const match = profileToContact.get(p.id);
              return match ? {
                contact_id: match.contact_id,
                contact_name: match.contact_name,
                profile_id: p.id,
                updated_at: p.updated_at,
                headline: p.headline,
              } : null;
            })
            .filter(Boolean) as LinkedConnection[];
          setLinkedConnections(linked.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
        }
      }

      let secondDegreeCount = 0;
      if (connectedUserIds.length > 0) {
        const { count } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .in("owner_id", connectedUserIds);
        secondDegreeCount = count || 0;
      }
      setNetworkSize(contactsList.length + secondDegreeCount);

      const contactMap = new Map<string, { name: string; company: string | null }>();
      contactsList.forEach((c) => contactMap.set(c.id, { name: c.full_name, company: c.company }));

      const allNotes = (notesRes.data || []) as any[];

      const actions: ActionItem[] = allNotes
        .filter((n: any) => n.action_text && !n.action_completed)
        .map((n: any) => ({
          id: n.id,
          action_text: n.action_text,
          action_due_date: n.action_due_date,
          action_completed: n.action_completed,
          importance: n.importance,
          entry_date: n.entry_date,
          contact_id: n.contact_id,
          contact_name: contactMap.get(n.contact_id)?.name || "Unknown",
          contact_company: contactMap.get(n.contact_id)?.company || null,
        }))
        .sort((a: ActionItem, b: ActionItem) => {
          const now = new Date().toISOString().split("T")[0];
          const aOverdue = a.action_due_date && a.action_due_date < now;
          const bOverdue = b.action_due_date && b.action_due_date < now;
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          if (a.action_due_date && b.action_due_date) return a.action_due_date.localeCompare(b.action_due_date);
          if (a.action_due_date) return -1;
          return 1;
        });

      setActionItems(actions);

      const recent: RecentNote[] = allNotes.slice(0, 10).map((n: any) => ({
        id: n.id,
        content: n.content,
        context: n.context,
        entry_date: n.entry_date,
        contact_id: n.contact_id,
        contact_name: contactMap.get(n.contact_id)?.name || "Unknown",
        created_at: n.created_at,
      }));
      setRecentNotes(recent);

      const rawInvitations = (invitationsRes.data || []) as { id: string; from_user_id: string; created_at: string }[];
      if (rawInvitations.length > 0) {
        const senderIds = rawInvitations.map((i) => i.from_user_id);
        const { data: senderProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, headline")
          .in("id", senderIds);
        const senderMap = new Map<string, { full_name: string; headline: string | null }>();
        (senderProfiles || []).forEach((p: any) => senderMap.set(p.id, p));
        setPendingInvitations(
          rawInvitations.map((i) => ({
            id: i.id,
            from_user_id: i.from_user_id,
            from_name: senderMap.get(i.from_user_id)?.full_name || "Unknown",
            from_headline: senderMap.get(i.from_user_id)?.headline || null,
            created_at: i.created_at,
          }))
        );
      }

      try {
        const code = await getOrCreateInviteCode(user.id);
        setInviteCode(code);
      } catch (e) {
        console.error("Failed to get invite code:", e);
      }

      setLoading(false);
    }
  }, [router]);

  async function completeAction(noteId: string) {
    const removed = actionItems.find((a) => a.id === noteId);
    setActionItems((prev) => prev.filter((a) => a.id !== noteId));
    const { data, error } = await supabase
      .from("contact_notes")
      .update({ action_completed: true })
      .eq("id", noteId)
      .select()
      .single();
    if (error || !data) {
      if (removed) setActionItems((prev) => [...prev, removed]);
      console.error("Failed to complete action:", error || "No rows updated");
    }
  }

  async function saveActionEdit(noteId: string) {
    const item = actionItems.find((a) => a.id === noteId);
    if (!item) return;
    const newText = editText.trim() || item.action_text;
    const newDue = editDue || null;
    // Optimistic update
    setActionItems((prev) =>
      prev.map((a) =>
        a.id === noteId ? { ...a, action_text: newText, action_due_date: newDue } : a
      )
    );
    setEditingId(null);
    const { error } = await supabase
      .from("contact_notes")
      .update({ action_text: newText, action_due_date: newDue })
      .eq("id", noteId);
    if (error) {
      // Revert
      if (item) {
        setActionItems((prev) =>
          prev.map((a) =>
            a.id === noteId ? { ...a, action_text: item.action_text, action_due_date: item.action_due_date } : a
          )
        );
      }
      console.error("Failed to update action:", error);
    }
  }

  async function createNewAction() {
    if (!newContactId || !newActionText.trim() || !userId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        owner_id: userId,
        contact_id: newContactId,
        content: newActionText.trim(),
        entry_date: new Date().toISOString().split("T")[0],
        action_text: newActionText.trim(),
        action_due_date: newActionDue || null,
        action_completed: false,
      })
      .select()
      .single();
    if (error) {
      console.error("Failed to create action:", error);
    } else if (data) {
      const contact = allContacts.find((c) => c.id === newContactId);
      setActionItems((prev) => [
        ...prev,
        {
          id: data.id,
          action_text: data.action_text,
          action_due_date: data.action_due_date,
          action_completed: false,
          importance: null,
          entry_date: data.entry_date,
          contact_id: data.contact_id,
          contact_name: contact?.full_name || "Unknown",
        },
      ]);
      setNewContactId("");
      setNewActionText("");
      setNewActionDue("");
      setShowNewForm(false);
    }
    setSaving(false);
  }

  async function respondToInvitation(invitationId: string, accept: boolean) {
    setRespondingTo(invitationId);
    if (accept) {
      await supabase.rpc("accept_link_invitation", {
        p_invitation_id: invitationId,
      });
    } else {
      await supabase
        .from("link_invitations")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", invitationId);
    }
    setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    setRespondingTo(null);
  }

  function getInviteUrl(): string {
    if (typeof window !== "undefined" && userId) {
      return `${window.location.origin}/connect/${userId}`;
    }
    return "";
  }

  function copyUrl() {
    const url = getInviteUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  }

  function copyCode() {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function formatShortDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function daysUntil(dateStr: string): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  function startEditing(item: ActionItem) {
    setEditingId(item.id);
    setEditText(item.action_text);
    setEditDue(item.action_due_date || "");
    setTimeout(() => editRef.current?.focus(), 0);
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0f172a",
          color: "#94a3b8",
        }}
      >
        Loading...
      </div>
    );
  }

  const overdueCount = actionItems.filter(
    (a) => a.action_due_date && new Date(a.action_due_date) < new Date()
  ).length;
  const dueSoonCount = actionItems.filter((a) => {
    if (!a.action_due_date) return false;
    const days = daysUntil(a.action_due_date);
    return days >= 0 && days <= 7;
  }).length;
  const laterCount = actionItems.length - overdueCount - dueSoonCount;

  const avatarUrl = profile?.profile_photo_url || profile?.avatar_url;

  const inputStyle: React.CSSProperties = {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "5px",
    color: "#e2e8f0",
    fontSize: "13px",
    padding: "6px 8px",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <Nav />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* ═══════════════════════════════════════════════════════
            ACTION ITEMS — the primary feature, always on top
            ═══════════════════════════════════════════════════════ */}
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "15px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "#fbbf24",
              }}
            >
              Action Items
            </span>
            <button
              onClick={() => {
                setShowNewForm((v) => {
                  if (!v) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setNewActionDue(tomorrow.toISOString().split("T")[0]);
                  }
                  return !v;
                });
              }}
              style={{
                padding: "4px 14px",
                background: showNewForm ? "#334155" : "#fbbf24",
                color: showNewForm ? "#94a3b8" : "#0f172a",
                border: "none",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {showNewForm ? "Cancel" : "+ New"}
            </button>
          </div>

          {/* New action item form */}
          {showNewForm && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                padding: "12px",
                background: "#0f172a",
                borderRadius: "8px",
                marginBottom: "14px",
                flexWrap: "wrap",
              }}
            >
              <select
                value={newContactId}
                onChange={(e) => setNewContactId(e.target.value)}
                style={{
                  ...inputStyle,
                  minWidth: "140px",
                  flex: "0 0 auto",
                }}
              >
                <option value="">Select person...</option>
                {allContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Action item..."
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createNewAction();
                }}
                style={{ ...inputStyle, flex: "1 1 200px" }}
              />
              <input
                type="date"
                value={newActionDue}
                onChange={(e) => setNewActionDue(e.target.value)}
                style={{ ...inputStyle, flex: "0 0 auto" }}
              />
              <button
                onClick={createNewAction}
                disabled={saving || !newContactId || !newActionText.trim()}
                style={{
                  padding: "6px 16px",
                  background: !newContactId || !newActionText.trim() ? "#334155" : "#fbbf24",
                  color: !newContactId || !newActionText.trim() ? "#64748b" : "#0f172a",
                  border: "none",
                  borderRadius: "5px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: !newContactId || !newActionText.trim() ? "default" : "pointer",
                  opacity: saving ? 0.5 : 1,
                  flex: "0 0 auto",
                }}
              >
                {saving ? "Adding..." : "Add"}
              </button>
            </div>
          )}

          {/* Pending invitations */}
          {pendingInvitations.map((inv) => (
            <div
              key={inv.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 0",
                borderBottom: "1px solid #334155",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#a78bfa",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", color: "#e2e8f0" }}>
                  <span style={{ fontWeight: 600 }}>{inv.from_name}</span>
                  <span style={{ color: "#94a3b8" }}> wants to connect</span>
                </div>
                {inv.from_headline && (
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
                    {inv.from_headline}
                  </div>
                )}
              </div>
              <button
                onClick={() => respondToInvitation(inv.id, true)}
                disabled={respondingTo === inv.id}
                style={{
                  padding: "4px 12px",
                  background: "#a78bfa",
                  color: "#0f172a",
                  border: "none",
                  borderRadius: "5px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                  opacity: respondingTo === inv.id ? 0.5 : 1,
                }}
              >
                Accept
              </button>
              <button
                onClick={() => respondToInvitation(inv.id, false)}
                disabled={respondingTo === inv.id}
                style={{
                  padding: "4px 10px",
                  background: "transparent",
                  color: "#64748b",
                  border: "1px solid #334155",
                  borderRadius: "5px",
                  fontSize: "11px",
                  cursor: "pointer",
                  flexShrink: 0,
                  opacity: respondingTo === inv.id ? 0.5 : 1,
                }}
              >
                Decline
              </button>
            </div>
          ))}

          {/* Action items list */}
          {actionItems.length === 0 && pendingInvitations.length === 0 && !showNewForm ? (
            <div style={{ color: "#475569", fontSize: "13px", padding: "8px 0" }}>
              No pending action items. You&apos;re all caught up.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {actionItems.map((item) => {
                const isOverdue =
                  item.action_due_date &&
                  new Date(item.action_due_date) < new Date();
                const isEditing = editingId === item.id;

                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 0",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => completeAction(item.id)}
                      style={{
                        width: "18px",
                        height: "18px",
                        cursor: "pointer",
                        accentColor: "#a78bfa",
                        flexShrink: 0,
                      }}
                    />

                    {/* Person name / company */}
                    <Link
                      href={`/contacts/${item.contact_id}`}
                      style={{
                        color: "#a78bfa",
                        textDecoration: "none",
                        fontSize: "14px",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{item.contact_name}</span>
                      {item.contact_company && (
                        <span style={{ fontWeight: 400, opacity: 0.55 }}>
                          {" / "}{item.contact_company}
                        </span>
                      )}
                    </Link>

                    {/* Action text — editable */}
                    {isEditing ? (
                      <input
                        ref={editRef}
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveActionEdit(item.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        style={{
                          ...inputStyle,
                          flex: 1,
                          minWidth: 0,
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(item)}
                        style={{
                          fontSize: "14px",
                          color: "#e2e8f0",
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          borderBottom: "1px dashed transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "#475569")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
                      >
                        {item.action_text}
                      </span>
                    )}

                    {/* Due date — editable */}
                    {isEditing ? (
                      <>
                        <input
                          type="date"
                          value={editDue}
                          onChange={(e) => setEditDue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveActionEdit(item.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          style={{ ...inputStyle, flex: "0 0 auto" }}
                        />
                        <button
                          onClick={() => saveActionEdit(item.id)}
                          style={{
                            padding: "4px 10px",
                            background: "#fbbf24",
                            color: "#0f172a",
                            border: "none",
                            borderRadius: "5px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          onClick={() => startEditing(item)}
                          style={{
                            fontSize: "12px",
                            fontWeight: isOverdue ? 700 : 500,
                            color: isOverdue ? "#f87171" : item.action_due_date ? "#94a3b8" : "#475569",
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: isOverdue ? "rgba(239,68,68,0.1)" : "transparent",
                          }}
                        >
                          {item.action_due_date
                            ? isOverdue
                              ? `overdue · ${formatShortDate(item.action_due_date)}`
                              : formatShortDate(item.action_due_date)
                            : "no date"}
                        </span>
                        {/* Edit icon */}
                        <span
                          onClick={() => startEditing(item)}
                          style={{
                            fontSize: "12px",
                            color: "#334155",
                            cursor: "pointer",
                            flexShrink: 0,
                            padding: "2px 4px",
                            opacity: 0.5,
                            transition: "opacity 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
                          title="Edit"
                        >
                          ✎
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            CONNECTION UPDATES
            ═══════════════════════════════════════════════════════ */}
        {linkedConnections.length > 0 && (
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: "20px",
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
              Updates by Your Connections
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {linkedConnections.slice(0, 5).map((conn) => {
                const days = daysUntil(conn.updated_at);
                const isRecent = days > -7;
                return (
                  <div
                    key={conn.profile_id}
                    onClick={() => router.push(`/contacts/${conn.contact_id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "5px 0",
                      borderBottom: "1px solid rgba(30,41,59,0.5)",
                      cursor: "pointer",
                    }}
                  >
                    {isRecent && (
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "#60a5fa",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span style={{ fontSize: "12px", color: "#e2e8f0", fontWeight: isRecent ? 500 : 400 }}>
                      {conn.contact_name}
                    </span>
                    {conn.headline && (
                      <span style={{ fontSize: "11px", color: "#475569", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conn.headline}
                      </span>
                    )}
                    <span style={{ fontSize: "10px", color: isRecent ? "#60a5fa" : "#334155", whiteSpace: "nowrap", flexShrink: 0 }}>
                      updated {formatShortDate(conn.updated_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            RECENT ACTIVITY
            ═══════════════════════════════════════════════════════ */}
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
            }}
          >
            Your Recent Activity
          </div>

          {recentNotes.length === 0 ? (
            <div style={{ color: "#475569", fontSize: "13px" }}>
              No activity yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentNotes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "8px",
                    padding: "5px 0",
                    borderBottom: "1px solid rgba(30,41,59,0.5)",
                    cursor: "pointer",
                  }}
                  onClick={() => router.push(`/contacts/${note.contact_id}`)}
                >
                  <span style={{ fontSize: "10px", color: "#334155", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {formatShortDate(note.entry_date)}
                  </span>
                  <Link
                    href={`/contacts/${note.contact_id}`}
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {note.contact_name}
                  </Link>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {note.content.slice(0, 80)}
                    {note.content.length > 80 ? "..." : ""}
                  </span>
                  {note.context && (
                    <span
                      style={{
                        fontSize: "9px",
                        color: "#475569",
                        background: "#0f172a",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        flexShrink: 0,
                      }}
                    >
                      {note.context}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            BOTTOM SECTION — profile, stats, invite (less important)
            ═══════════════════════════════════════════════════════ */}

        {/* Profile header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: "bold",
              color: "#a78bfa",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                style={{ width: "44px", height: "44px", objectFit: "cover" }}
              />
            ) : (
              profile?.full_name?.[0] || "?"
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "16px", fontWeight: "bold" }}>
              {profile?.full_name || "Unknown"}
            </div>
            {profile?.headline && (
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "1px" }}>
                {profile.headline}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flex: "1 1 220px",
            }}
          >
            <RingChart
              segments={[
                { value: overdueCount, color: "#ef4444" },
                { value: dueSoonCount, color: "#eab308" },
                { value: laterCount, color: "#22c55e" },
              ]}
              label="actions"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "11px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ color: "#94a3b8" }}>{overdueCount} overdue</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#eab308" }} />
                <span style={{ color: "#94a3b8" }}>{dueSoonCount} this week</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ color: "#94a3b8" }}>{laterCount} upcoming</span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "14px 18px",
              flex: "1 1 180px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Network</span>
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>{networkSize}</span>
            </div>
            <MiniBar value={networkSize} max={Math.max(networkSize, 50)} color="#f59e0b" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contacts</span>
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>{totalContacts}</span>
            </div>
            <MiniBar value={totalContacts} max={Math.max(totalContacts, 20)} color="#a78bfa" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Links</span>
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>{connectionCount}</span>
            </div>
            <MiniBar value={connectionCount} max={Math.max(totalContacts, 1)} color="#60a5fa" />
          </div>
        </div>

        {/* Invite section */}
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "10px",
            }}
          >
            Invite to NEXUS
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
            <div
              style={{
                flex: 1,
                padding: "7px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#a78bfa",
                fontSize: "12px",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {getInviteUrl() || "Loading..."}
            </div>
            <button
              onClick={copyUrl}
              style={{
                padding: "7px 14px",
                background: copiedUrl ? "#22c55e" : "#a78bfa",
                color: copiedUrl ? "#fff" : "#0f172a",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {copiedUrl ? "Copied!" : "Copy Link"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div
              style={{
                padding: "7px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#e2e8f0",
                fontSize: "14px",
                fontFamily: "monospace",
                fontWeight: "bold",
                letterSpacing: "1px",
              }}
            >
              {inviteCode || "..."}
            </div>
            <span style={{ fontSize: "11px", color: "#475569" }}>invite code</span>
            <button
              onClick={copyCode}
              style={{
                padding: "5px 12px",
                background: copied ? "#22c55e" : "transparent",
                color: copied ? "#fff" : "#64748b",
                border: copied ? "none" : "1px solid #334155",
                borderRadius: "6px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Quick nav */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { href: "/resume", label: "Profile" },
            { href: "/contacts", label: "Contacts" },
            { href: "/network", label: "Network" },
            { href: "/chronicle", label: "Chronicle" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                flex: "1 1 0",
                padding: "12px 14px",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                textDecoration: "none",
                textAlign: "center",
                fontSize: "13px",
                color: "#94a3b8",
                fontWeight: 500,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#334155";
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#1e293b";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
