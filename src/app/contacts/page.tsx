"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";

// ─── Types ───
interface ContactRow {
  id: string;
  full_name: string;
  company: string | null;
  role: string | null;
  relationship_type: string | null;
  ai_summary: string | null;
  mini_summary: string | null;
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

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : fullName.toLowerCase();
}

function deriveMiniDescription(c: ContactRow): string {
  if (c.mini_summary) return c.mini_summary;
  if (c.role && c.company) return `${c.role} at ${c.company}`;
  if (c.role) return c.role;
  if (c.company) return `Works at ${c.company}`;
  if (c.relationship_type) return c.relationship_type;
  return "";
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [actions, setActions] = useState<Record<string, PendingAction>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"alpha" | "recent">("alpha");
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
          "id, full_name, company, role, relationship_type, ai_summary, mini_summary, linked_profile_id, updated_at, created_at"
        )
        .eq("owner_id", user.id),
      supabase
        .from("contact_notes")
        .select("contact_id, action_text, action_due_date")
        .eq("owner_id", user.id)
        .eq("action_completed", false)
        .not("action_text", "is", null)
        .order("action_due_date", { ascending: true, nullsFirst: false }),
    ]);

    setContacts(contactsRes.data || []);

    const actionMap: Record<string, PendingAction> = {};
    for (const a of actionsRes.data || []) {
      if (!actionMap[a.contact_id]) {
        actionMap[a.contact_id] = a as PendingAction;
      }
    }
    setActions(actionMap);
    setLoading(false);
  }

  // Filter
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
    filtered = filtered.filter((c) => {
      const ln = getLastName(c.full_name);
      return ln[0]?.toUpperCase() === alphaFilter;
    });
  }

  // Sort
  if (sortMode === "recent") {
    filtered = [...filtered].sort((a, b) => {
      const aDate = a.updated_at || a.created_at;
      const bDate = b.updated_at || b.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  } else {
    filtered = [...filtered].sort((a, b) =>
      getLastName(a.full_name).localeCompare(getLastName(b.full_name))
    );
  }

  // Which letters have contacts (by last name)
  const activeLetters = new Set(
    contacts
      .map((c) => getLastName(c.full_name)[0]?.toUpperCase())
      .filter(Boolean)
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
    <div
      style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}
    >
      <Nav />

      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "24px 20px 60px",
        }}
      >
        {/* Header */}
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

        {/* Alpha tabs — by last name */}
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
            const hasContacts = activeLetters.has(letter);
            const isActive = alphaFilter === letter;
            return (
              <button
                key={letter}
                onClick={() => hasContacts && setAlphaFilter(isActive ? null : letter)}
                style={{
                  padding: "2px 6px",
                  fontSize: "11px",
                  border: "none",
                  borderRadius: "3px",
                  cursor: hasContacts ? "pointer" : "default",
                  background: isActive ? "#a78bfa" : "transparent",
                  color: isActive ? "#0f172a" : hasContacts ? "#94a3b8" : "#334155",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Contact list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "#475569",
                padding: "40px 0",
                fontSize: "14px",
              }}
            >
              {search || alphaFilter ? "No contacts match your filter." : "No contacts yet. Add your first one!"}
            </div>
          )}

          {filtered.map((c) => {
            const action = actions[c.id];
            const miniDesc = deriveMiniDescription(c);
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/contacts/${c.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "#1e293b",
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  border: "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#334155";
                  e.currentTarget.style.borderColor = "#475569";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#1e293b";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: c.linked_profile_id ? "#7c3aed" : "#334155",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: c.linked_profile_id ? "#fff" : "#94a3b8",
                    flexShrink: 0,
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
                        fontWeight: 500,
                        fontSize: "14px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.full_name}
                    </span>
                    {c.linked_profile_id && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#a78bfa",
                          background: "#1e1b4b",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          fontWeight: 500,
                        }}
                      >
                        Linked
                      </span>
                    )}
                    {c.relationship_type && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                        }}
                      >
                        {c.relationship_type}
                      </span>
                    )}
                  </div>
                  {miniDesc && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        marginTop: "2px",
                      }}
                    >
                      {miniDesc}
                    </div>
                  )}
                  {action && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#f59e0b",
                        marginTop: "3px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>⚡</span>
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {action.action_text}
                      </span>
                      {action.action_due_date && (
                        <span style={{ color: "#92400e", flexShrink: 0 }}>
                          · {formatDate(action.action_due_date)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <span style={{ color: "#334155", fontSize: "16px", flexShrink: 0 }}>›</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
