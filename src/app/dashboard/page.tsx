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
}

interface ContactRow {
  id: string;
  full_name: string;
  company: string | null;
  role: string | null;
  relationship_type: string;
  last_contact_date: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
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

      const [profileRes, contactsRes, connectionsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, headline, avatar_url")
          .eq("id", user.id)
          .single(),
        supabase
          .from("contacts")
          .select(
            "id, full_name, company, role, relationship_type, last_contact_date"
          )
          .eq("owner_id", user.id)
          .order("last_contact_date", { ascending: false, nullsFirst: false })
          .limit(5),
        supabase
          .from("connections")
          .select("id")
          .eq("status", "accepted")
          .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`),
      ]);

      setProfile(profileRes.data as Profile);
      setContacts((contactsRes.data as ContactRow[]) || []);
      setConnectionCount(connectionsRes.data?.length || 0);

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

  function getInviteUrl(): string {
    if (typeof window !== "undefined" && userId) {
      return `${window.location.origin}/connect/${userId}`;
    }
    return "";
  }

  function copyCode() {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function copyUrl() {
    const url = getInviteUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
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
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
      }}
    >
      <Nav />

      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        {/* Profile header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              fontWeight: "bold",
              color: "#a78bfa",
            }}
          >
            {profile?.full_name?.[0] || "?"}
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>
              {profile?.full_name || "Unknown"}
            </div>
            <div style={{ fontSize: "14px", color: "#94a3b8" }}>
              {profile?.headline || ""}
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: "12px",
              fontSize: "13px",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                background: "#1e293b",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                {contacts.length}
              </div>
              <div style={{ color: "#64748b", fontSize: "11px" }}>Contacts</div>
            </div>
            <div
              style={{
                padding: "8px 16px",
                background: "#1e293b",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                {connectionCount}
              </div>
              <div style={{ color: "#64748b", fontSize: "11px" }}>Linked</div>
            </div>
          </div>
        </div>

        {/* Two columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
          }}
        >
          {/* Left: Recent contacts */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontWeight: "bold", fontSize: "15px" }}>
                Recent Contacts
              </span>
              <Link
                href="/contacts"
                style={{
                  color: "#64748b",
                  fontSize: "12px",
                  textDecoration: "none",
                }}
              >
                View all →
              </Link>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {contacts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/contacts/${c.id}`)}
                  style={{
                    padding: "12px 14px",
                    background: "#1e293b",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#334155")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#1e293b")
                  }
                >
                  <div style={{ fontWeight: 500, fontSize: "14px" }}>
                    {c.full_name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "12px" }}>
                    {[c.role, c.company].filter(Boolean).join(" · ") ||
                      c.relationship_type}
                  </div>
                </div>
              ))}
              {contacts.length === 0 && (
                <div
                  style={{
                    color: "#475569",
                    fontSize: "13px",
                    padding: "12px",
                  }}
                >
                  No contacts yet. Add your first one!
                </div>
              )}
            </div>
          </div>

          {/* Right: Invite */}
          <div>
            <span
              style={{
                fontWeight: "bold",
                fontSize: "15px",
                display: "block",
                marginBottom: "12px",
              }}
            >
              Invite to NEXUS
            </span>
            <div
              style={{
                background: "#1e293b",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "13px",
                  marginBottom: "16px",
                  lineHeight: "1.5",
                }}
              >
                Share your invite link or code with someone. When they join,
                you'll be automatically connected.
              </p>

              {/* Invite URL */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#64748b",
                    fontSize: "11px",
                    display: "block",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Invite Link
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#a78bfa",
                      fontSize: "13px",
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
                      padding: "10px 16px",
                      background: copiedUrl ? "#22c55e" : "#a78bfa",
                      color: copiedUrl ? "#fff" : "#0f172a",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "background 0.2s",
                    }}
                  >
                    {copiedUrl ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Invite Code */}
              <div>
                <label
                  style={{
                    color: "#64748b",
                    fontSize: "11px",
                    display: "block",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Invite Code
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                      fontSize: "15px",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      letterSpacing: "1px",
                    }}
                  >
                    {inviteCode || "Loading..."}
                  </div>
                  <button
                    onClick={copyCode}
                    style={{
                      padding: "10px 16px",
                      background: copied ? "#22c55e" : "transparent",
                      color: copied ? "#fff" : "#94a3b8",
                      border: copied ? "none" : "1px solid #334155",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.2s",
                    }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div style={{ marginTop: "24px" }}>
              <span
                style={{
                  fontWeight: "bold",
                  fontSize: "15px",
                  display: "block",
                  marginBottom: "12px",
                }}
              >
                Quick Links
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {[
                  {
                    href: "/resume",
                    label: "My Profile",
                    desc: "Edit your resume & profile",
                  },
                  {
                    href: "/contacts",
                    label: "Contacts",
                    desc: "Manage your CRM",
                  },
                  {
                    href: "/network",
                    label: "Network",
                    desc: "Visualize connections",
                  },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      padding: "12px 14px",
                      background: "#1e293b",
                      borderRadius: "8px",
                      textDecoration: "none",
                      transition: "background 0.15s",
                      display: "block",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#334155")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "#1e293b")
                    }
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: "14px",
                        color: "#e2e8f0",
                      }}
                    >
                      {link.label}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "12px" }}>
                      {link.desc}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
