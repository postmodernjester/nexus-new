"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrCreateInviteCode } from "@/lib/connections";
import Link from "next/link";
import QRCode from "react-qr-code";

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
          .select("id, full_name, company, role, relationship_type, last_contact_date")
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
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                <div style={{ color: "#475569", fontSize: "13px", padding: "12px" }}>
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
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              {/* QR Code */}
              {userId && (
                <div
                  style={{
                    background: "#fff",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <QRCode value={getInviteUrl()} size={140} />
                </div>
              )}

              {/* Invite code */}
              {inviteCode && (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      marginBottom: "4px",
                    }}
                  >
                    Your invite code
                  </div>
                  <div
                    onClick={copyCode}
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      fontFamily: "monospace",
                      letterSpacing: "2px",
                      cursor: "pointer",
                      color: copied ? "#10b981" : "#e2e8f0",
                      transition: "color 0.2s",
                    }}
                  >
                    {copied ? "Copied!" : inviteCode}
                  </div>
                </div>
              )}

              {/* Shareable URL */}
              {userId && (
                <div style={{ width: "100%", textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      marginBottom: "6px",
                    }}
                  >
                    Or share this link
                  </div>
                  <div
                    onClick={copyUrl}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      background: "#0f172a",
                      borderRadius: "6px",
                      cursor: "pointer",
                      border: "1px solid #334155",
                      transition: "all 0.2s",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        color: copiedUrl ? "#10b981" : "#94a3b8",
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "240px",
                      }}
                    >
                      {copiedUrl ? "Copied!" : getInviteUrl()}
                    </span>
                    <span style={{ fontSize: "14px", flexShrink: 0 }}>
                      {copiedUrl ? "✓" : "📋"}
                    </span>
                  </div>
                </div>
              )}

              <div
                style={{
                  fontSize: "11px",
                  color: "#475569",
                  textAlign: "center",
                  lineHeight: "1.5",
                }}
              >
                Share the link or code with someone.
                <br />
                When they join, you'll be connected automatically.
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div
          style={{
            marginTop: "32px",
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            onClick={() => router.push("/contacts/new")}
            style={{
              padding: "10px 20px",
              background: "#a78bfa",
              color: "#0f172a",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            + Add Contact
          </button>
          <button
            onClick={() => router.push("/network")}
            style={{
              padding: "10px 20px",
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            View Network
          </button>
        </div>
      </div>
    </div>
  );
}
