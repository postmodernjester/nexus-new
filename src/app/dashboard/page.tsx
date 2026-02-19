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
  const [totalContacts, setTotalContacts] = useState(0);
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

      const [profileRes, contactsRes, totalRes, connectionsRes] = await Promise.all([
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
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("connections")
          .select("id")
          .eq("status", "accepted")
          .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`),
      ]);

      setProfile(profileRes.data as Profile);
      setContacts((contactsRes.data as ContactRow[]) || []);
      setTotalContacts(totalRes.count || 0);
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
      <div style={{ minHeight: "100vh", background: "#0f172a" }}>
        <Nav />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            color: "#94a3b8",
          }}
        >
          Loading…
        </div>
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
                {totalContacts}
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
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* Invite URL */}
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    marginBottom: "6px",
                  }}
                >
                  Share this link to connect with someone:
                </div>
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
                      padding: "8px 12px",
                      background: "#0f172a",
                      borderRadius: "6px",
                      fontSize: "13px",
                      color: "#94a3b8",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      border: "1px solid #334155",
                    }}
                  >
                    {getInviteUrl() || "Loading…"}
                  </div>
                  <button
                    onClick={copyUrl}
                    style={{
                      padding: "8px 14px",
                      background: copiedUrl ? "#059669" : "#a78bfa",
                      color: copiedUrl ? "#fff" : "#0f172a",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copiedUrl ? "Copied!" : "Copy URL"}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  borderTop: "1px solid #334155",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "-10px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#1e293b",
                    padding: "0 8px",
                    fontSize: "11px",
                    color: "#475569",
                  }}
                >
                  or use code
                </span>
              </div>

              {/* Invite Code */}
              <div>
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
                      padding: "8px 12px",
                      background: "#0f172a",
                      borderRadius: "6px",
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "#e2e8f0",
                      fontFamily: "monospace",
                      letterSpacing: "1px",
                      textAlign: "center",
                      border: "1px solid #334155",
                    }}
                  >
                    {inviteCode || "…"}
                  </div>
                  <button
                    onClick={copyCode}
                    style={{
                      padding: "8px 14px",
                      background: copied ? "#059669" : "transparent",
                      color: copied ? "#fff" : "#94a3b8",
                      border: copied ? "none" : "1px solid #334155",
                      borderRadius: "6px",
                      fontWeight: 500,
                      fontSize: "12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copied ? "Copied!" : "Copy Code"}
                  </button>
                </div>
              </div>

              <div
                style={{ fontSize: "11px", color: "#475569", lineHeight: 1.4 }}
              >
                When someone signs up using your link or enters your code, you'll
                automatically be connected and can see each other in your networks.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
