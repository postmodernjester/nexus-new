"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewCompanyPage() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [headquarters, setHeadquarters] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function toSlug(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const slug = toSlug(name);

    // Check if already exists
    const { data: existing } = await supabase
      .from("companies")
      .select("id, slug")
      .eq("slug", slug)
      .single();

    if (existing) {
      router.push(`/companies/${existing.slug}`);
      return;
    }

    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: name.trim(),
        slug,
        industry: industry.trim() || null,
        headquarters: headquarters.trim() || null,
        website: website.trim() || null,
        description: description.trim() || null,
        created_by: user.id,
      })
      .select("slug")
      .single();

    if (error) {
      alert("Failed to create company: " + error.message);
      setSaving(false);
    } else if (data) {
      router.push(`/companies/${data.slug}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/companies")}
            className="text-gray-400 hover:text-gray-200 text-sm"
          >
            ← Companies
          </button>
          <h1 className="text-2xl font-semibold">Add Company</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Company Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
              placeholder="e.g. Acme Corp"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Industry</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
              placeholder="e.g. Technology, Finance, Healthcare"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Headquarters</label>
            <input
              type="text"
              value={headquarters}
              onChange={(e) => setHeadquarters(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
              placeholder="e.g. New York, NY"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-gray-500"
              placeholder="What does this company do?"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Company"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/companies")}
              className="text-gray-400 hover:text-gray-200 text-sm px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
