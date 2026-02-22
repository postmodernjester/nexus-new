"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";

interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string | null;
  website: string | null;
  headquarters: string | null;
  size: string | null;
  founded_year: number | null;
  logo_url: string | null;
  ai_summary: string | null;
}

interface CompanyUser {
  id: string;
  full_name: string;
  title: string;
  is_current: boolean;
}

export default function CompanyProfilePage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Company>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Try slug first, then id, then name match
      let { data } = await supabase
        .from("companies")
        .select("*")
        .eq("slug", slug)
        .single();

      if (!data) {
        const res = await supabase
          .from("companies")
          .select("*")
          .eq("id", slug)
          .single();
        data = res.data;
      }

      if (!data) {
        // Try matching by name (for companies navigated from world page)
        const deslugified = slug.replace(/-/g, " ");
        const { data: nameMatch } = await supabase
          .from("companies")
          .select("*")
          .ilike("name", deslugified)
          .limit(1)
          .single();
        data = nameMatch;
      }

      if (!data) {
        // Auto-create company from slug (navigated from world page)
        const deslugified = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const { data: created, error: createErr } = await supabase
          .from("companies")
          .insert({
            name: deslugified,
            slug: slug,
          })
          .select("*")
          .single();
        if (!createErr && created) {
          data = created;
        }
      }

      if (data) {
        setCompany(data);
        setForm(data);
        await loadUsers(data.name);
      }
      setLoading(false);
    }
    fetchData();
  }, [slug]);

  async function loadUsers(companyName: string) {
    // Find all users who have work entries at this company
    const { data: workEntries } = await supabase
      .from("work_entries")
      .select("user_id, title, is_current, company")
      .ilike("company", companyName);

    if (!workEntries || workEntries.length === 0) {
      setCompanyUsers([]);
      return;
    }

    const userIds = [...new Set(workEntries.map(w => w.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

    // Build user list, preferring current roles
    const userMap = new Map<string, CompanyUser>();
    for (const w of workEntries) {
      const existing = userMap.get(w.user_id);
      if (!existing || (w.is_current && !existing.is_current)) {
        userMap.set(w.user_id, {
          id: w.user_id,
          full_name: profileMap.get(w.user_id) || "Unknown",
          title: w.title || "",
          is_current: w.is_current || false,
        });
      }
    }

    const users = Array.from(userMap.values()).sort((a, b) => {
      if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
      return a.full_name.localeCompare(b.full_name);
    });
    setCompanyUsers(users);
  }

  async function handleSave() {
    if (!company) return;
    setSaving(true);

    const { error } = await supabase
      .from("companies")
      .update({
        description: form.description,
        industry: form.industry,
        website: form.website,
        headquarters: form.headquarters,
        size: form.size,
        founded_year: form.founded_year,
        ai_summary: form.ai_summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    if (error) {
      // Retry without ai_summary in case column doesn't exist yet
      const { error: retryErr } = await supabase
        .from("companies")
        .update({
          description: form.description,
          industry: form.industry,
          website: form.website,
          headquarters: form.headquarters,
          size: form.size,
          founded_year: form.founded_year,
          updated_at: new Date().toISOString(),
        })
        .eq("id", company.id);
      if (retryErr) {
        alert("Failed to save: " + retryErr.message);
        setSaving(false);
        return;
      }
    }

    setCompany({ ...company, ...form } as Company);
    setEditing(false);
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a" }}>
        <Nav />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#64748b" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
        <Nav />
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ color: "#64748b", marginBottom: "16px" }}>Company not found</p>
          <button
            onClick={() => router.push("/world")}
            style={{
              padding: "8px 20px",
              background: "#a78bfa",
              color: "#0f172a",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Back to World
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <Nav />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Back link */}
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: "13px",
            cursor: "pointer",
            padding: 0,
            marginBottom: "16px",
          }}
        >
          ← Back
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 6px" }}>{company.name}</h1>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "13px", color: "#64748b" }}>
              {company.industry && <span>{company.industry}</span>}
              {company.headquarters && <span>{company.headquarters}</span>}
              {company.founded_year && <span>Founded {company.founded_year}</span>}
              {company.size && <span>{company.size} employees</span>}
            </div>
            {company.website && (
              <a
                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none", marginTop: "4px", display: "inline-block" }}
              >
                {company.website}
              </a>
            )}
          </div>
          <button
            onClick={() => setEditing(!editing)}
            style={{
              padding: "6px 14px",
              background: "transparent",
              color: "#94a3b8",
              border: "1px solid #334155",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>

        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* AI Summary */}
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                AI Summary
              </label>
              <textarea
                value={form.ai_summary || ""}
                onChange={(e) => setForm({ ...form, ai_summary: e.target.value })}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "14px",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
                placeholder="Brief AI-generated or community summary of this company..."
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Description
              </label>
              <textarea
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "14px",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
                placeholder="What does this company do?"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Industry</label>
                <input
                  type="text"
                  value={form.industry || ""}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="e.g. Technology"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Headquarters</label>
                <input
                  type="text"
                  value={form.headquarters || ""}
                  onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="e.g. San Francisco, CA"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Website</label>
                <input
                  type="text"
                  value={form.website || ""}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Company Size</label>
                <select
                  value={form.size || ""}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">Select...</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="501-1000">501-1000</option>
                  <option value="1001-5000">1001-5000</option>
                  <option value="5001-10000">5001-10000</option>
                  <option value="10000+">10000+</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Founded Year</label>
                <input
                  type="number"
                  value={form.founded_year || ""}
                  onChange={(e) => setForm({ ...form, founded_year: parseInt(e.target.value) || null })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="e.g. 2015"
                />
              </div>
            </div>

            <div>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "8px 20px",
                  background: "#a78bfa",
                  color: "#0f172a",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

            <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
              This page is a wiki — anyone can edit it. We'll add ownership rules later.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* AI Summary */}
            {company.ai_summary && (
              <div
                style={{
                  padding: "16px 20px",
                  background: "#1e293b",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  borderLeft: "3px solid #a78bfa",
                }}
              >
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                  Summary
                </div>
                <p style={{ fontSize: "14px", color: "#cbd5e1", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap" }}>
                  {company.ai_summary}
                </p>
              </div>
            )}

            {/* Description */}
            {company.description ? (
              <div>
                <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  About
                </h2>
                <p style={{ fontSize: "14px", color: "#cbd5e1", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap" }}>
                  {company.description}
                </p>
              </div>
            ) : !company.ai_summary ? (
              <div
                style={{
                  padding: "24px",
                  background: "#1e293b",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
                  No description yet. Click Edit to add one.
                </p>
              </div>
            ) : null}

            {/* People at this company */}
            <div>
              <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                People ({companyUsers.length})
              </h2>
              {companyUsers.length === 0 ? (
                <div style={{ color: "#475569", fontSize: "13px" }}>
                  No users linked to this company yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {companyUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => router.push(`/world/${u.id}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        background: "#1e293b",
                        borderRadius: "8px",
                        border: "1px solid transparent",
                        cursor: "pointer",
                        transition: "background 0.15s",
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
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: "#334155",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#94a3b8",
                          flexShrink: 0,
                        }}
                      >
                        {u.full_name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: "14px" }}>{u.full_name}</div>
                        {u.title && (
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {u.title}
                            {u.is_current && (
                              <span style={{ color: "#22c55e", marginLeft: "6px", fontSize: "10px" }}>Current</span>
                            )}
                          </div>
                        )}
                      </div>
                      <span style={{ color: "#475569", fontSize: "12px" }}>→</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
