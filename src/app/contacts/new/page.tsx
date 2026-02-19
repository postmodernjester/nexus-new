"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ─── Nav ───
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/network", label: "Network" },
  { href: "/contacts", label: "Contacts" },
  { href: "/resume", label: "My Profile" },
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

const REL_TYPES = [
  "Family",
  "Close Friend",
  "Friend",
  "Colleague",
  "Business Contact",
  "Acquaintance",
  "Other",
];

export default function NewContactPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [relationship, setRelationship] = useState("Acquaintance");
  const [initialNote, setInitialNote] = useState("");

  async function handleCreate() {
    if (!fullName.trim()) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        owner_id: user.id,
        full_name: fullName.trim(),
        role: role.trim() || null,
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        location: location.trim() || null,
        relationship_type: relationship,
      })
      .select()
      .single();

    if (error) {
      alert("Failed: " + error.message);
      setSaving(false);
      return;
    }

    // If there's an initial note, add it
    if (initialNote.trim() && contact) {
      await supabase.from("contact_notes").insert({
        contact_id: contact.id,
        owner_id: user.id,
        content: initialNote.trim(),
        entry_date: new Date().toISOString().split("T")[0],
        action_completed: false,
      });
    }

    // Go straight to the dossier page
    router.push(`/contacts/${contact.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreate();
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block",
    fontSize: "11px",
    color: "#64748b",
    marginBottom: "4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  };

  return (
    <div
      style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}
    >
      <Nav />

      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          padding: "32px 20px 60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
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
            ← Contacts
          </Link>
        </div>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: "bold",
            margin: "0 0 24px 0",
          }}
        >
          New Contact
        </h1>

        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          {/* Name — the only thing that matters */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Name</label>
            <input
              style={{
                ...inputStyle,
                fontSize: "18px",
                padding: "12px 14px",
              }}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Their name"
              autoFocus
            />
          </div>

          {/* Role + Company side by side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label style={labelStyle}>Role / Title</label>
              <input
                style={inputStyle}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What they do"
              />
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <input
                style={inputStyle}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Where they work"
              />
            </div>
          </div>

          {/* Contact info */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Optional"
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                style={inputStyle}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Location + Relationship */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label style={labelStyle}>Location</label>
              <input
                style={inputStyle}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="City, area"
              />
            </div>
            <div>
              <label style={labelStyle}>Relationship</label>
              <select
                style={inputStyle}
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              >
                {REL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              borderTop: "1px solid #334155",
              margin: "20px 0",
            }}
          />

          {/* Initial note */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>First Note</label>
            <textarea
              style={{
                ...inputStyle,
                resize: "vertical" as const,
                fontFamily: "inherit",
                lineHeight: "1.5",
                minHeight: "80px",
              }}
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How do you know them? What are you working on? Paste a LinkedIn URL, anything…"
              rows={3}
            />
            <div
              style={{
                fontSize: "10px",
                color: "#475569",
                marginTop: "4px",
              }}
            >
              You can always add more notes on their dossier page
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button
              onClick={() => router.push("/contacts")}
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !fullName.trim()}
              style={{
                padding: "10px 24px",
                background:
                  saving || !fullName.trim() ? "#475569" : "#a78bfa",
                color: "#0f172a",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                cursor:
                  saving || !fullName.trim() ? "default" : "pointer",
              }}
            >
              {saving ? "Creating…" : "Create Contact"}
            </button>
          </div>

          <div
            style={{
              fontSize: "10px",
              color: "#475569",
              textAlign: "right",
              marginTop: "8px",
            }}
          >
            ⌘+Enter to save
          </div>
        </div>
      </div>
    </div>
  );
}
