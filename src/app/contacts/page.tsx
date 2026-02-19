"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
interface ContactRow {
  id: string;
  full_name: string;
  company: string | null;
  role: string | null;
  relationship_type: string | null;
  ai_summary: string | null;
  linked_profile_id: string | null;
  updated_at: string | null;
  created_at: string;
}

interface PendingAction {
  contact_id: string;
  action_text: string;
  action_due_date: string | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
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

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [actions, setActions] = useState<Record<string, PendingAction>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"alpha" | "recent">("recent");
  const [alphaFilter, setAlphaFilter] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const [contactsRes, actionsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select(
          "id, full_name, company, role, relationship_type, ai_summary, linked_profile_id, updated_at, created_at"
        )
        .eq("owner_id", user.id)
        .order("full_name", { ascending: true }),
      supabase
        .from("contact_notes")
        .select("contact_id, action_text, action_due_date")
        .eq("owner_id", user.id)
        .eq("action_completed", false)
        .not("action_text", "is", null)
        .order("action_due_date", { ascending: true, nullsFirst: false }),
    ]);

    setContacts(contactsRes.data || []);

    // Build map of latest pending action per contact
    const actionMap: Record<string, PendingAction> = {};
    for (const a of actionsRes.data || []) {
      if (!actionMap[a.contact_id]) {
        actionMap[a.contact_id] = a as PendingAction;
      }
    }
    setActions(actionMap);
    setLoading(false);
  }

  // Filter and sort
  let filtered = contacts;

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.role || "").toLowerCase().includes(q)
    );
  }

  if (alphaFilter) {
    filtered = filtered.filter((c) =>
      c.full_name.toUpperCase().startsWith(alphaFilter!)
    );
  }

  if (sortMode === "recent") {
    filtered = [...filtered].sort((a, b) => {
      const aDate = a.updated_at || a.created_at;
      const bDate = b.updated_at || b.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  } else {
    filtered = [...filtered].sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  }

  // Which letters have contacts
  const activeLettrs = new Set(
    contacts.map((c) => c.full_name[0]?.toUpperCase()).filter(Boolean)
  );

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

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <Nav />

      <div
        style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 20px 60px" }}
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
          <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>
            Contacts
            <span
              style={{
                fontSize: "14px",
                fontWeight: "normal",
                color: "#64748b",
                marginLeft: "8px",
              }}
            >
              {contacts.length}
            </span>
          </h1>
          <button
            onClick={() => router.push("/contacts/new")}
            style={{
              padding: "8px 18px",
              background: "#a78bfa",
              color: "#0f172a",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            + Add
          </button>
        </div>

        {/* Search + sort */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <input
            type="text"
            placeholder="Search name, company, role…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setAlphaFilter(null);
            }}
            style={{
              flex: 1,
              padding: "8px 14px",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              background: "#1e293b",
              borderRadius: "6px",
              border: "1px solid #334155",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setSortMode("recent")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                background: sortMode === "recent" ? "#334155" : "transparent",
                color: sortMode === "recent" ? "#e2e8f0" : "#64748b",
              }}
            >
              Recent
            </button>
            <button
              onClick={() => setSortMode("alpha")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                background: sortMode === "alpha" ? "#334155" : "transparent",
                color: sortMode === "alpha" ? "#e2e8f0" : "#64748b",
              }}
            >
              A–Z
            </button>
          </div>
        </div>

        {/* Alpha tabs */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "2px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => setAlphaFilter(null)}
            style={{
              padding: "2px 6px",
              fontSize: "11px",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              background: alphaFilter === null ? "#a78bfa" : "transparent",
              color: alphaFilter === null ? "#0f172a" : "#64748b",
              fontWeight: alphaFilter === null ? 600 : 400,
            }}
          >
            All
          </button>
          {ALPHA.map((letter) => {
            const hasContacts = activeLettrs.has(letter);
            const isActive = alphaFilter === letter;
            return (
              <button
                key={letter}
                onClick={() => {
                  if (hasContacts) {
                    setAlphaFilter(isActive ? null : letter);
                    setSearch("");
                  }
                }}
                style={{
                  padding: "2px 5px",
                  fontSize: "11px",
                  border: "none",
                  borderRadius: "3px",
                  cursor: hasContacts ? "pointer" : "default",
                  background: isActive ? "#a78bfa" : "transparent",
                  color: isActive
                    ? "#0f172a"
                    : hasContacts
                      ? "#94a3b8"
                      : "#1e293b",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Contact list */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((c) => {
            const action = actions[c.id];
            const summarySnippet = c.ai_summary
              ? c.ai_summary.length > 120
                ? c.ai_summary.slice(0, 120) + "…"
                : c.ai_summary
              : null;
            const isOverdue =
              action?.action_due_date &&
              new Date(action.action_due_date) < new Date();

            return (
              <div
                key={c.id}
                onClick={() => router.push(`/contacts/${c.id}`)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "14px 12px",
                  borderBottom: "1px solid #1e293b",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(30,41,59,0.6)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: c.linked_profile_id
                      ? "rgba(96,165,250,0.15)"
                      : "#1e293b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: c.linked_profile_id ? "#60a5fa" : "#64748b",
                    fontSize: "13px",
                    fontWeight: "bold",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {initials(c.full_name)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#e2e8f0",
                      }}
                    >
                      {c.full_name}
                    </span>
                    {c.relationship_type && (
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "1px 6px",
                          borderRadius: "8px",
                          background: "#334155",
                          color: "#64748b",
                        }}
                      >
                        {c.relationship_type}
                      </span>
                    )}
                    {c.linked_profile_id && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#60a5fa",
                        }}
                      >
                        ●
                      </span>
                    )}
                  </div>

                  {/* Role / Company */}
                  {(c.role || c.company) && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#94a3b8",
                        marginTop: "1px",
                      }}
                    >
                      {[c.role, c.company].filter(Boolean).join(" · ")}
                    </div>
                  )}

                  {/* AI summary snippet */}
                  {summarySnippet && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginTop: "4px",
                        lineHeight: "1.4",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {summarySnippet}
                    </div>
                  )}

                  {/* Pending action */}
                  {action && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "4px",
                        fontSize: "11px",
                        color: isOverdue ? "#f87171" : "#fbbf24",
                      }}
                    >
                      <span style={{ fontSize: "9px" }}>
                        {isOverdue ? "⚠" : "○"}
                      </span>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {action.action_text}
                      </span>
                      {action.action_due_date && (
                        <span style={{ color: "#475569", flexShrink: 0 }}>
                          {formatDate(action.action_due_date)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: updated date */}
                <div
                  style={{
                    fontSize: "11px",
                    color: "#475569",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {formatDate(c.updated_at || c.created_at)}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "#475569",
                fontSize: "14px",
              }}
            >
              {search || alphaFilter
                ? "No contacts match your search."
                : "No contacts yet. Add your first one!"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
