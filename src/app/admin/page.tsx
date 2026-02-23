"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  isPublic: boolean;
  hasProfile: boolean;
  photo: string | null;
  createdAt: string;
  lastSignIn: string | null;
  contactCount: number;
  noteCount: number;
  workCount: number;
  linkedCount: number;
  pendingInvitesSent: number;
  pendingInvitesReceived: number;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Email editing
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  // Deletion
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function loadUsers() {
    const token = await getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      setError("unauthorized");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError("Failed to load users");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setUsers(data.users);
    setAdminId(data.adminId);
    setLoading(false);
  }

  async function handleEmailSave(userId: string) {
    if (!emailDraft.trim()) return;
    setEmailSaving(true);
    const token = await getToken();
    const res = await fetch("/api/admin/update-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, email: emailDraft.trim() }),
    });

    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, email: emailDraft.trim() } : u))
      );
      setEditingEmail(null);
    } else {
      const data = await res.json();
      alert("Failed to update email: " + (data.error || "Unknown error"));
    }
    setEmailSaving(false);
  }

  async function handleDelete(userId: string) {
    setDeleting(true);
    const token = await getToken();
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setDeleteConfirm(null);
      setDeleteTyped("");
    } else {
      const data = await res.json();
      alert("Delete failed: " + (data.error || "Unknown error"));
    }
    setDeleting(false);
  }

  // ─── Unauthorized state ───
  if (error === "unauthorized") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
        <Nav />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "16px", color: "#64748b" }}>Not authorized</div>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "8px 20px",
              background: "#1e293b",
              color: "#94a3b8",
              border: "1px solid #334155",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading ───
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

  // ─── Filter ───
  const filtered = search.trim()
    ? users.filter(
        (u) =>
          u.fullName.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const totalContacts = users.reduce((s, u) => s + u.contactCount, 0);
  const totalLinked = users.reduce((s, u) => s + u.linkedCount, 0) / 2; // each link counted twice

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <Nav />

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Header */}
        <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px" }}>
          Admin
          <span
            style={{
              fontSize: "14px",
              fontWeight: "normal",
              color: "#64748b",
              marginLeft: "8px",
            }}
          >
            {users.length} {users.length === 1 ? "user" : "users"}
          </span>
        </h1>
        <div style={{ fontSize: "12px", color: "#475569", marginBottom: "20px" }}>
          {totalContacts} contacts across all users · {Math.round(totalLinked)} active links
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 14px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            color: "#e2e8f0",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "16px",
          }}
        />

        {/* User list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "#475569",
                padding: "40px 0",
                fontSize: "14px",
              }}
            >
              {search ? "No users match your search." : "No users found."}
            </div>
          )}

          {filtered.map((u) => {
            const isAdmin = u.id === adminId;
            const isDeleting = deleteConfirm === u.id;
            const isEditingEmail = editingEmail === u.id;
            const dataItems = u.contactCount + u.noteCount + u.workCount;

            return (
              <div
                key={u.id}
                style={{
                  padding: "14px 16px",
                  background: "#1e293b",
                  borderRadius: "10px",
                  border: isDeleting
                    ? "1px solid #ef4444"
                    : "1px solid transparent",
                }}
              >
                {/* Row 1: Avatar + Name + Joined */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "8px",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: u.photo ? "none" : "#334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#94a3b8",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {u.photo ? (
                      <img
                        src={u.photo}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      initials(u.fullName)
                    )}
                  </div>

                  {/* Name + badges */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {u.fullName}
                      </span>
                      {isAdmin && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#d4af37",
                            background: "#2a2000",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontWeight: 500,
                          }}
                        >
                          You
                        </span>
                      )}
                      {!u.hasProfile && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#f59e0b",
                            background: "#1c1000",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontWeight: 500,
                          }}
                        >
                          No profile
                        </span>
                      )}
                      {u.hasProfile && !u.isPublic && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#64748b",
                            background: "#0f172a",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontWeight: 500,
                            border: "1px solid #334155",
                          }}
                        >
                          Private
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Joined date */}
                  <div
                    style={{
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      Joined {formatDate(u.createdAt)}
                    </div>
                    {u.lastSignIn && (
                      <div style={{ fontSize: "10px", color: "#475569", marginTop: "1px" }}>
                        Last seen {daysSince(u.lastSignIn)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Email */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                    paddingLeft: "48px",
                  }}
                >
                  {isEditingEmail ? (
                    <>
                      <input
                        type="email"
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEmailSave(u.id);
                          if (e.key === "Escape") setEditingEmail(null);
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          background: "#0f172a",
                          border: "1px solid #475569",
                          borderRadius: "5px",
                          color: "#e2e8f0",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => handleEmailSave(u.id)}
                        disabled={emailSaving}
                        style={{
                          padding: "3px 10px",
                          background: "#22c55e",
                          color: "#fff",
                          border: "none",
                          borderRadius: "5px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          opacity: emailSaving ? 0.5 : 1,
                        }}
                      >
                        {emailSaving ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingEmail(null)}
                        style={{
                          padding: "3px 10px",
                          background: "transparent",
                          color: "#64748b",
                          border: "1px solid #334155",
                          borderRadius: "5px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{u.email}</span>
                      <button
                        onClick={() => {
                          setEditingEmail(u.id);
                          setEmailDraft(u.email);
                        }}
                        style={{
                          padding: "2px 8px",
                          background: "transparent",
                          color: "#475569",
                          border: "1px solid #334155",
                          borderRadius: "4px",
                          fontSize: "10px",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>

                {/* Row 3: Stats */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    paddingLeft: "48px",
                    flexWrap: "wrap",
                  }}
                >
                  <StatBadge label="contacts" count={u.contactCount} />
                  <StatBadge label="notes" count={u.noteCount} />
                  <StatBadge label="work" count={u.workCount} />
                  <StatBadge
                    label="linked"
                    count={u.linkedCount}
                    color={u.linkedCount > 0 ? "#a78bfa" : undefined}
                  />
                  {u.pendingInvitesSent > 0 && (
                    <StatBadge
                      label="invites sent"
                      count={u.pendingInvitesSent}
                      color="#f59e0b"
                    />
                  )}
                  {u.pendingInvitesReceived > 0 && (
                    <StatBadge
                      label="invites received"
                      count={u.pendingInvitesReceived}
                      color="#22c55e"
                    />
                  )}

                  {/* Spacer + Delete button */}
                  <div style={{ flex: 1 }} />
                  {!isAdmin && !isDeleting && (
                    <button
                      onClick={() => {
                        setDeleteConfirm(u.id);
                        setDeleteTyped("");
                      }}
                      style={{
                        padding: "4px 10px",
                        background: "transparent",
                        color: "#64748b",
                        border: "1px solid #334155",
                        borderRadius: "5px",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#ef4444";
                        e.currentTarget.style.color = "#ef4444";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#334155";
                        e.currentTarget.style.color = "#64748b";
                      }}
                    >
                      Delete user
                    </button>
                  )}
                </div>

                {/* Delete confirmation panel */}
                {isDeleting && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px 14px",
                      background: "#1a0000",
                      borderRadius: "8px",
                      border: "1px solid #7f1d1d",
                      marginLeft: "48px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#fca5a5",
                        fontWeight: 600,
                        marginBottom: "6px",
                      }}
                    >
                      Permanently delete {u.fullName}?
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        marginBottom: "10px",
                        lineHeight: "1.5",
                      }}
                    >
                      This will remove their auth account, profile, {u.contactCount} contacts,{" "}
                      {u.noteCount} notes, {u.workCount} work entries, all chronicle data, and
                      unlink them from {u.linkedCount} connections. This cannot be undone.
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        marginBottom: "8px",
                      }}
                    >
                      Type <strong style={{ color: "#fca5a5" }}>DELETE</strong> to confirm:
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        type="text"
                        value={deleteTyped}
                        onChange={(e) => setDeleteTyped(e.target.value)}
                        placeholder="DELETE"
                        autoFocus
                        style={{
                          padding: "5px 10px",
                          background: "#0f172a",
                          border: "1px solid #7f1d1d",
                          borderRadius: "5px",
                          color: "#fca5a5",
                          fontSize: "12px",
                          fontWeight: 600,
                          width: "100px",
                          outline: "none",
                          letterSpacing: "1px",
                        }}
                      />
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deleteTyped !== "DELETE" || deleting}
                        style={{
                          padding: "5px 14px",
                          background:
                            deleteTyped === "DELETE" ? "#ef4444" : "#334155",
                          color:
                            deleteTyped === "DELETE" ? "#fff" : "#475569",
                          border: "none",
                          borderRadius: "5px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor:
                            deleteTyped === "DELETE" ? "pointer" : "default",
                          opacity: deleting ? 0.5 : 1,
                        }}
                      >
                        {deleting ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm(null);
                          setDeleteTyped("");
                        }}
                        style={{
                          padding: "5px 12px",
                          background: "transparent",
                          color: "#64748b",
                          border: "1px solid #334155",
                          borderRadius: "5px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <span
      style={{
        fontSize: "11px",
        color: color || (count > 0 ? "#94a3b8" : "#475569"),
      }}
    >
      <strong style={{ fontWeight: 600 }}>{count}</strong> {label}
    </span>
  );
}
