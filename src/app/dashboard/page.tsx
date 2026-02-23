"use client";

import { useEffect, useState } from "react";
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

interface LinkedConnection {
  contact_id: string;
  contact_name: string;
  profile_id: string;
  updated_at: string;
  headline: string | null;
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
  const [totalNotes, setTotalNotes] = useState(0);
  const [networkSize, setNetworkSize] = useState(0); // total including 2nd degree
  const [linkedConnections, setLinkedConnections] = useState<LinkedConnection[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Fetch all data in parallel
      const [profileRes, contactsRes, connectionsRes, notesRes, noteCountRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, headline, avatar_url, profile_photo_url")
            .eq("id", user.id)
            .single(),
          supabase
            .from("contacts")
            .select("id, full_name, linked_profile_id")
            .eq("owner_id", user.id),
          supabase
            .from("connections")
            .select("id, inviter_id, invitee_id")
            .eq("status", "accepted")
            .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`),
          // Get recent notes with contact info
          supabase
            .from("contact_notes")
            .select("id, content, context, entry_date, contact_id, action_text, action_due_date, action_completed, importance, created_at")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("contact_notes")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id),
        ]);

      setProfile(profileRes.data as Profile);
      const contactsList = (contactsRes.data || []) as { id: string; full_name: string; linked_profile_id: string | null }[];
      setTotalContacts(contactsList.length);
      const connectionsList = (connectionsRes.data || []) as { id: string; inviter_id: string; invitee_id: string }[];
      setConnectionCount(connectionsList.length);
      setTotalNotes(noteCountRes.count || 0);

      // Get connected user IDs for 2nd-degree network
      const connectedUserIds = connectionsList.map((c) =>
        c.inviter_id === user.id ? c.invitee_id : c.inviter_id
      );

      // Fetch linked profiles' updated_at for content modification tracking
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

      // 2nd-degree network size
      let secondDegreeCount = 0;
      if (connectedUserIds.length > 0) {
        const { count } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .in("owner_id", connectedUserIds);
        secondDegreeCount = count || 0;
      }
      setNetworkSize(contactsList.length + secondDegreeCount);

      // Build contact name lookup
      const contactMap = new Map<string, string>();
      contactsList.forEach((c) => contactMap.set(c.id, c.full_name));

      const allNotes = (notesRes.data || []) as any[];

      // Extract action items (pending)
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
          contact_name: contactMap.get(n.contact_id) || "Unknown",
        }))
        .sort((a: ActionItem, b: ActionItem) => {
          // Sort: overdue first, then by due date, then by importance
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

      // Recent notes (last 10)
      const recent: RecentNote[] = allNotes.slice(0, 10).map((n: any) => ({
        id: n.id,
        content: n.content,
        context: n.context,
        entry_date: n.entry_date,
        contact_id: n.contact_id,
        contact_name: contactMap.get(n.contact_id) || "Unknown",
        created_at: n.created_at,
      }));
      setRecentNotes(recent);

      try {
        const code = await getOrCreateInviteCode(user.id);
        setInviteCode(code);
      } catch (e) {
        console.error("Failed to get invite code:", e);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function completeAction(noteId: string) {
    await supabase
      .from("contact_notes")
      .update({ action_completed: true })
      .eq("id", noteId);
    setActionItems((prev) => prev.filter((a) => a.id !== noteId));
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

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <Nav />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Profile header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "#1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
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
                style={{ width: "52px", height: "52px", objectFit: "cover" }}
              />
            ) : (
              profile?.full_name?.[0] || "?"
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "18px", fontWeight: "bold" }}>
              {profile?.full_name || "Unknown"}
            </div>
            {profile?.headline && (
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "1px" }}>
                {profile.headline}
              </div>
            )}
          </div>
        </div>

        {/* Stats row with ring charts */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          {/* Action items ring */}
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
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
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ color: "#94a3b8" }}>{overdueCount} overdue</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#eab308" }} />
                <span style={{ color: "#94a3b8" }}>{dueSoonCount} this week</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ color: "#94a3b8" }}>{laterCount} upcoming</span>
              </div>
            </div>
          </div>

          {/* Network stats */}
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "16px 20px",
              flex: "1 1 180px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contacts</span>
              <span style={{ fontSize: "20px", fontWeight: "bold" }}>{totalContacts}</span>
            </div>
            <MiniBar value={totalContacts} max={Math.max(totalContacts, 20)} color="#a78bfa" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Linked</span>
              <span style={{ fontSize: "20px", fontWeight: "bold" }}>{connectionCount}</span>
            </div>
            <MiniBar value={connectionCount} max={Math.max(totalContacts, 1)} color="#60a5fa" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Network</span>
              <span style={{ fontSize: "20px", fontWeight: "bold" }}>{networkSize}</span>
            </div>
            <MiniBar value={networkSize} max={Math.max(networkSize, 50)} color="#f59e0b" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Notes</span>
              <span style={{ fontSize: "20px", fontWeight: "bold" }}>{totalNotes}</span>
            </div>
            <MiniBar value={totalNotes} max={Math.max(totalNotes, 50)} color="#22c55e" />
          </div>
        </div>

        {/* ACTION ITEMS — main feature */}
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "#fbbf24",
              }}
            >
              Action Items
            </span>
            <Link
              href="/contacts"
              style={{ color: "#475569", fontSize: "11px", textDecoration: "none" }}
            >
              All contacts
            </Link>
          </div>

          {actionItems.length === 0 ? (
            <div style={{ color: "#475569", fontSize: "13px", padding: "8px 0" }}>
              No pending action items. You're all caught up.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {actionItems.map((item) => {
                const isOverdue =
                  item.action_due_date &&
                  new Date(item.action_due_date) < new Date();
                const importanceColor = item.importance
                  ? { green: "#22c55e", yellow: "#eab308", red: "#ef4444" }[item.importance] || "#334155"
                  : null;

                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "8px 0",
                      borderBottom: "1px solid rgba(30,41,59,0.8)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => completeAction(item.id)}
                      style={{
                        marginTop: "3px",
                        cursor: "pointer",
                        accentColor: "#a78bfa",
                        flexShrink: 0,
                      }}
                    />
                    {importanceColor && (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: importanceColor,
                          flexShrink: 0,
                          marginTop: "5px",
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", color: "#e2e8f0" }}>
                        {item.action_text}
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginTop: "2px", fontSize: "11px" }}>
                        <Link
                          href={`/contacts/${item.contact_id}`}
                          style={{ color: "#64748b", textDecoration: "none" }}
                        >
                          {item.contact_name}
                        </Link>
                        {item.action_due_date && (
                          <span
                            style={{
                              color: isOverdue ? "#f87171" : "#475569",
                              fontWeight: isOverdue ? 600 : 400,
                            }}
                          >
                            {isOverdue ? "overdue" : `due ${formatShortDate(item.action_due_date)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CONNECTION UPDATES */}
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
              Connection Updates
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

        {/* RECENT ACTIVITY */}
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
            Recent Activity
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

        {/* INVITE SECTION — compact */}
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
            Invite to NEXUS
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
            <div
              style={{
                flex: 1,
                padding: "8px 12px",
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
                padding: "8px 14px",
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
                padding: "8px 12px",
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
                padding: "6px 12px",
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
