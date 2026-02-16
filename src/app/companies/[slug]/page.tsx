"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

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
}

export default function CompanyProfilePage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Company>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const params = useParams();
  const supabase = createClientComponentClient();
  const slug = params.slug as string;

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Try slug first, then id
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

      if (data) {
        setCompany(data);
        setForm(data);
      }
      setLoading(false);
    }
    fetch();
  }, [slug]);

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
        updated_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    if (error) {
      alert("Failed to save: " + error.message);
    } else {
      setCompany({ ...company, ...form } as Company);
      setEditing(false);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Company not found</p>
          <button onClick={() => router.push("/companies")} className="text-blue-400 hover:text-blue-300 text-sm">
            ← Back to companies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/companies")}
            className="text-gray-400 hover:text-gray-200 text-sm"
          >
            ← Companies
          </button>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold">{company.name}</h1>
            <div className="flex gap-4 mt-2 text-sm text-gray-400">
              {company.industry && <span>{company.industry}</span>}
              {company.headquarters && <span>📍 {company.headquarters}</span>}
              {company.founded_year && <span>Founded {company.founded_year}</span>}
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg px-3 py-1.5"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
                placeholder="What does this company do?"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Industry</label>
                <input
                  type="text"
                  value={form.industry || ""}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
                  placeholder="e.g. Technology"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Headquarters</label>
                <input
                  type="text"
                  value={form.headquarters || ""}
                  onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
                  placeholder="e.g. San Francisco, CA"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Website</label>
                <input
                  type="text"
                  value={form.website || ""}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Company Size</label>
                <select
                  value={form.size || ""}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
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
                <label className="block text-sm text-gray-400 mb-1">Founded Year</label>
                <input
                  type="number"
                  value={form.founded_year || ""}
                  onChange={(e) => setForm({ ...form, founded_year: parseInt(e.target.value) || null })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
                  placeholder="e.g. 2015"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {company.description ? (
              <div>
                <h2 className="text-sm font-medium text-gray-400 mb-2">About</h2>
                <p className="text-gray-300 whitespace-pre-wrap">{company.description}</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
                <p className="text-gray-500 text-sm">No description yet. Click Edit to add one.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              {company.website && (
                <div>
                  <h3 className="text-sm text-gray-400 mb-1">Website</h3>
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    {company.website}
                  </a>
                </div>
              )}
              {company.size && (
                <div>
                  <h3 className="text-sm text-gray-400 mb-1">Company Size</h3>
                  <p className="text-gray-300 text-sm">{company.size} employees</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
