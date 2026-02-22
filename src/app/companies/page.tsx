"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Company {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  headquarters: string | null;
  size: string | null;
  description: string | null;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("companies")
        .select("id, name, slug, industry, headquarters, size, description")
        .order("name");

      if (data) setCompanies(data);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.industry && c.industry.toLowerCase().includes(search.toLowerCase())) ||
    (c.headquarters && c.headquarters.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading companies...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-400 hover:text-gray-200 text-sm"
            >
              ← Dashboard
            </button>
            <h1 className="text-2xl font-semibold">Companies</h1>
          </div>
          <button
            onClick={() => router.push("/companies/new")}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg"
          >
            + Add Company
          </button>
        </div>

        <input
          type="text"
          placeholder="Search companies by name, industry, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 mb-6 focus:outline-none focus:border-gray-500"
        />

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-2">
              {search ? "No companies match your search" : "No companies yet"}
            </p>
            <p className="text-gray-500 text-sm">
              Companies are added automatically when users enter employers, or you can add one manually.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((company) => (
              <div
                key={company.id}
                onClick={() => router.push(`/companies/${company.slug || company.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-200">{company.name}</h2>
                    <div className="flex gap-4 mt-1 text-sm text-gray-400">
                      {company.industry && <span>{company.industry}</span>}
                      {company.headquarters && <span>📍 {company.headquarters}</span>}
                      {company.size && <span>{company.size}</span>}
                    </div>
                    {company.description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{company.description}</p>
                    )}
                  </div>
                  <span className="text-gray-600 text-sm">→</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-gray-600">
          {filtered.length} {filtered.length === 1 ? "company" : "companies"}
        </div>
      </div>
    </div>
  );
}
