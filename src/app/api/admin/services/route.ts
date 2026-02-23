import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function verifyAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId || user.id !== adminId) return null;
  return user;
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const services: Record<string, unknown>[] = [];

  // ─── Supabase ───
  try {
    const [profilesRes, contactsRes, notesRes, workRes, connectionsRes, eduRes, storageRes] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("contacts").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("contact_notes").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("work_entries").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("connections").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("education").select("*", { count: "exact", head: true }),
        supabaseAdmin.storage.listBuckets(),
      ]);

    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
      .replace("https://", "")
      .replace(".supabase.co", "");

    services.push({
      name: "Supabase",
      status: "connected",
      plan: "Free",
      projectRef,
      metrics: {
        profiles: profilesRes.count ?? 0,
        contacts: contactsRes.count ?? 0,
        notes: notesRes.count ?? 0,
        workEntries: workRes.count ?? 0,
        education: eduRes.count ?? 0,
        connections: connectionsRes.count ?? 0,
        storageBuckets: storageRes.data?.length ?? 0,
      },
      limits: {
        database: "500 MB",
        fileStorage: "1 GB",
        bandwidth: "5 GB",
        monthlyActiveUsers: "50,000",
        edgeFunctions: "500K invocations",
      },
    });
  } catch (e: unknown) {
    services.push({
      name: "Supabase",
      status: "error",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }

  // ─── Anthropic (Claude AI) ───
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey !== "your_anthropic_api_key_here") {
    try {
      // Validate key with an intentionally bad request (empty messages).
      // Returns 400 if key is valid, 401/403 if key is invalid.
      // Costs zero tokens.
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [],
        }),
      });

      const isValid = res.status !== 401 && res.status !== 403;

      services.push({
        name: "Anthropic",
        status: isValid ? "connected" : "error",
        keyPreview: anthropicKey.slice(0, 14) + "…" + anthropicKey.slice(-4),
        billing: "Pay-per-use",
        dashboardUrl: "https://console.anthropic.com/settings/billing",
      });
    } catch (e: unknown) {
      services.push({
        name: "Anthropic",
        status: "error",
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  } else {
    services.push({
      name: "Anthropic",
      status: "not_configured",
      notes: "Set ANTHROPIC_API_KEY in .env.local",
    });
  }

  // ─── GitHub ───
  try {
    const ghRes = await fetch(
      "https://api.github.com/repos/postmodernjester/nexus-new",
      { headers: { Accept: "application/vnd.github.v3+json" } }
    );
    if (ghRes.ok) {
      const repo = await ghRes.json();
      services.push({
        name: "GitHub",
        status: "connected",
        url: repo.html_url,
        metrics: {
          visibility: repo.private ? "Private" : "Public",
          defaultBranch: repo.default_branch,
          size: `${Math.round(repo.size / 1024)} MB`,
          updatedAt: repo.pushed_at,
        },
        plan: "Free",
        limits: {
          privateRepos: "Unlimited",
          storage: "500 MB (soft)",
          lfsStorage: "1 GB",
          actionMinutes: "2,000 min/mo",
        },
      });
    } else {
      services.push({
        name: "GitHub",
        status: "configured",
        url: "https://github.com/postmodernjester/nexus-new",
        notes: "Repo is private — add GITHUB_TOKEN for detailed stats",
      });
    }
  } catch {
    services.push({
      name: "GitHub",
      status: "configured",
      url: "https://github.com/postmodernjester/nexus-new",
    });
  }

  // ─── Netlify ───
  services.push({
    name: "Netlify",
    status: "configured",
    plan: "Free",
    dashboardUrl: "https://app.netlify.com",
    limits: {
      bandwidth: "100 GB/mo",
      buildMinutes: "300 min/mo",
      concurrentBuilds: "1",
      serverlessFunctions: "125K req/mo",
    },
  });

  return NextResponse.json({ services });
}
