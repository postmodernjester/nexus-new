"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { unlinkContact } from "@/lib/connections";
import Nav from "@/components/Nav";

interface ProfileRow {
  id: string;
  full_name: string;
  headline: string | null;
  location: string | null;
  profile_photo_url: string | null;
  avatar_url: string | null;
  is_public: boolean;
}

interface CompanyRow {
  company: string;
  user_count: number;
}

interface InvitationRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  from_profile?: { full_name: string; headline: string | null };
}

interface MergePromptData {
  newContactId: string;
  linkedProfileId: string;
  linkedProfile: { full_name: string; headline: string | null; location: string | null };
  existingContacts: { id: string; full_name: string; email: string | null; company: string | null; role: string | null; location: string | null }[];
}

type Tab = "people" | "companies" | "invitations";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1
    ? parts[parts.length - 1].toLowerCase()
    : fullName.toLowerCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function WorldPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("people");
  const [loading, setLoading] = useState(true);

  // People
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"alpha" | "recent">("alpha");
  const [alphaFilter, setAlphaFilter] = useState<string | null>(null);

  // Companies
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companySearch, setCompanySearch] = useState("");

  // Invitations
  const [receivedInvitations, setReceivedInvitations] = useState<InvitationRow[]>([]);
  const [sentInvitations, setSentInvitations] = useState<InvitationRow[]>([]);

  // Connection state (who I'm already linked or invited)
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());
  const [pendingSentTo, setPendingSentTo] = useState<Set<string>>(new Set());
  const [pendingReceivedFrom, setPendingReceivedFrom] = useState<Set<string>>(new Set());
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  // Unlink
  const [unlinkConfirmId, setUnlinkConfirmId] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Merge prompt
  const [mergePrompt, setMergePrompt] = useState<MergePromptData | null>(null);
  const [merging, setMerging] = useState(false);

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
    setUserId(user.id);

    const [profilesRes, workRes, myContactsRes, invSentRes, invReceivedRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, headline, location, profile_photo_url, avatar_url, is_public"),
        supabase
          .from("work_entries")
          .select("user_id, company")
          .not("company", "is", null),
        supabase
          .from("contacts")
          .select("linked_profile_id")
          .eq("owner_id", user.id)
          .not("linked_profile_id", "is", null),
        supabase
          .from("link_invitations")
          .select("id, from_user_id, to_user_id, status, message, created_at")
          .eq("from_user_id", user.id),
        supabase
          .from("link_invitations")
          .select("id, from_user_id, to_user_id, status, message, created_at")
          .eq("to_user_id", user.id),
      ]);

    // Profiles (exclude self)
    const allProfiles = (profilesRes.data || []).filter(
      (p: ProfileRow) => p.id !== user.id
    );
    setProfiles(allProfiles);

    // Companies: group work entries by company (just names and counts)
    const companyMap = new Map<string, Set<string>>();
    for (const w of workRes.data || []) {
      if (!w.company) continue;
      const key = w.company.trim();
      if (!companyMap.has(key)) companyMap.set(key, new Set());
      companyMap.get(key)!.add(w.user_id);
    }
    const companyList: CompanyRow[] = Array.from(companyMap.entries())
      .map(([company, userIds]) => ({
        company,
        user_count: userIds.size,
      }))
      .sort((a, b) => a.company.localeCompare(b.company));
    setCompanies(companyList);

    // Linked = any contact card with linked_profile_id set
    const connIds = new Set(
      (myContactsRes.data || []).map((c: { linked_profile_id: string }) => c.linked_profile_id)
    );
    setConnectedUserIds(connIds);

    // Invitations
    const sent = (invSentRes.data || []) as InvitationRow[];
    const received = (invReceivedRes.data || []) as InvitationRow[];
    setSentInvitations(sent);

    // Fetch sender profiles for received invitations
    const senderIds = received.map((i) => i.from_user_id);
    if (senderIds.length > 0) {
      const { data: senderProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, headline")
        .in("id", senderIds);
      const profileMap = new Map((senderProfiles || []).map((p: any) => [p.id, p]));
      for (const inv of received) {
        inv.from_profile = profileMap.get(inv.from_user_id) || undefined;
      }
    }
    setReceivedInvitations(received);

    const sentTo = new Set(sent.filter((i) => i.status === "pending").map((i) => i.to_user_id));
    const recvFrom = new Set(received.filter((i) => i.status === "pending").map((i) => i.from_user_id));
    setPendingSentTo(sentTo);
    setPendingReceivedFrom(recvFrom);

    setLoading(false);
  }

  async function sendInvitation(toUserId: string) {
    if (!userId) return;
    setInviteSending(toUserId);
    const { error } = await supabase.from("link_invitations").insert({
      from_user_id: userId,
      to_user_id: toUserId,
    });
    if (!error) {
      setPendingSentTo((prev) => new Set(prev).add(toUserId));
    }
    setInviteSending(null);
  }

  async function respondToInvitation(
    invitationId: string,
    accept: boolean,
    senderUserId?: string,
    senderName?: string
  ) {
    setRespondingTo(invitationId);
    if (accept) {
      const { data } = await supabase.rpc("accept_link_invitation", {
        p_invitation_id: invitationId,
      });
      if (data?.success) {
        // Check for name-match duplicates before reloading
        if (senderUserId && senderName && userId) {
          await checkForDuplicateContacts(senderUserId, senderName);
        }
        await loadData();
      }
    } else {
      await supabase
        .from("link_invitations")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", invitationId);
      setReceivedInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: "declined" } : i))
      );
    }
    setRespondingTo(null);
  }

  async function checkForDuplicateContacts(linkedProfileId: string, linkedName: string) {
    if (!userId) return;
    // Find the newly created linked contact card
    const { data: newContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("owner_id", userId)
      .eq("linked_profile_id", linkedProfileId)
      .limit(1)
      .single();
    if (!newContact) return;

    // Check for existing unlinked contacts with the same name
    const { data: dupes } = await supabase
      .from("contacts")
      .select("id, full_name, email, company, role, location")
      .eq("owner_id", userId)
      .is("linked_profile_id", null)
      .ilike("full_name", linkedName);
    if (!dupes || dupes.length === 0) return;

    // Get the linked profile info for comparison hints
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, headline, location")
      .eq("id", linkedProfileId)
      .single();

    setMergePrompt({
      newContactId: newContact.id,
      linkedProfileId,
      linkedProfile: profile || { full_name: linkedName, headline: null, location: null },
      existingContacts: dupes,
    });
  }

  async function handleMerge(keepContactId: string) {
    if (!mergePrompt) return;
    setMerging(true);
    const { data } = await supabase.rpc("merge_duplicate_contact", {
      p_keep_id: keepContactId,
      p_remove_id: mergePrompt.newContactId,
    });
    if (data?.success) {
      setMergePrompt(null);
      await loadData();
    }
    setMerging(false);
  }

  async function handleUnlink(profileId: string, fullName: string) {
    if (!userId) return;
    setUnlinking(true);

    // Find my contact card for this person
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("owner_id", userId)
      .eq("linked_profile_id", profileId)
      .limit(1)
      .single();

    if (contact) {
      const result = await unlinkContact(userId, contact.id, profileId, fullName);
      if (result.success) {
        setConnectedUserIds((prev) => {
          const next = new Set(prev);
          next.delete(profileId);
          return next;
        });
      }
    }

    setUnlinkConfirmId(null);
    setUnlinking(false);
  }

  function getLinkStatus(profileId: string): "connected" | "sent" | "received" | "none" {
    if (connectedUserIds.has(profileId)) return "connected";
    if (pendingSentTo.has(profileId)) return "sent";
    if (pendingReceivedFrom.has(profileId)) return "received";
    return "none";
  }

  // ─── Filter & sort people ───
  let filtered = profiles;
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.headline || "").toLowerCase().includes(q) ||
        (p.location || "").toLowerCase().includes(q)
    );
  }
  if (alphaFilter) {
    filtered = filtered.filter(
      (p) => getLastName(p.full_name)[0]?.toUpperCase() === alphaFilter
    );
  }
  if (sortMode === "alpha") {
    filtered = [...filtered].sort((a, b) =>
      getLastName(a.full_name).localeCompare(getLastName(b.full_name))
    );
  }

  const activeLetters = new Set(
    profiles.map((p) => getLastName(p.full_name)[0]?.toUpperCase()).filter(Boolean)
  );

  // ─── Filter companies ───
  let filteredCompanies = companies;
  if (companySearch.trim()) {
    const q = companySearch.toLowerCase();
    filteredCompanies = filteredCompanies.filter((c) =>
      c.company.toLowerCase().includes(q)
    );
  }

  const pendingReceivedCount = receivedInvitations.filter((i) => i.status === "pending").length;

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
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <Nav />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Header */}
        <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 16px" }}>
          World
          <span style={{ fontSize: "14px", fontWeight: "normal", color: "#64748b", marginLeft: "8px" }}>
            {profiles.length} {profiles.length === 1 ? "person" : "people"}
          </span>
        </h1>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "2px",
            marginBottom: "16px",
            background: "#1e293b",
            borderRadius: "8px",
            padding: "3px",
            border: "1px solid #334155",
          }}
        >
          {(["people", "companies", "invitations"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: "13px",
                fontWeight: tab === t ? 600 : 400,
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: tab === t ? "#334155" : "transparent",
                color: tab === t ? "#e2e8f0" : "#64748b",
                position: "relative",
              }}
            >
              {t === "people" ? "People" : t === "companies" ? "Companies" : "Invitations"}
              {t === "invitations" && pendingReceivedCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 8,
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {pendingReceivedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══ PEOPLE TAB ═══ */}
        {tab === "people" && (
          <>
            {/* Search + sort */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <input
                type="text"
                placeholder="Search name, headline, location…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setAlphaFilter(null); }}
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

            {/* Alpha tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", marginBottom: "16px" }}>
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
                const has = activeLetters.has(letter);
                const active = alphaFilter === letter;
                return (
                  <button
                    key={letter}
                    onClick={() => has && setAlphaFilter(active ? null : letter)}
                    style={{
                      padding: "2px 6px",
                      fontSize: "11px",
                      border: "none",
                      borderRadius: "3px",
                      cursor: has ? "pointer" : "default",
                      background: active ? "#a78bfa" : "transparent",
                      color: active ? "#0f172a" : has ? "#94a3b8" : "#334155",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* People list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", color: "#475569", padding: "40px 0", fontSize: "14px" }}>
                  {search || alphaFilter ? "No people match your filter." : "No profiles yet."}
                </div>
              )}
              {filtered.map((p) => {
                const status = getLinkStatus(p.id);
                const isPrivate = !p.is_public;
                const photo = !isPrivate ? (p.profile_photo_url || p.avatar_url) : null;
                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/world/${p.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      background: "#1e293b",
                      borderRadius: "10px",
                      border: "1px solid transparent",
                      transition: "background 0.15s",
                      opacity: isPrivate ? 0.6 : 1,
                      cursor: "pointer",
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
                        background: photo ? "none" : "#334155",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#94a3b8",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      {photo ? (
                        <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        initials(p.full_name)
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontWeight: 500,
                            fontSize: "14px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {p.full_name}
                        </span>
                        {status === "connected" && (
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
                        {isPrivate && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#64748b",
                              background: "#1e293b",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontWeight: 500,
                              border: "1px solid #334155",
                            }}
                          >
                            Private
                          </span>
                        )}
                      </div>
                      {!isPrivate && p.headline && (
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
                          {p.headline}
                        </div>
                      )}
                      {!isPrivate && p.location && (
                        <div style={{ fontSize: "11px", color: "#475569", marginTop: "1px" }}>
                          {p.location}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div style={{ flexShrink: 0 }}>
                      {isPrivate ? (
                        // Private profiles — no link button
                        <span style={{ fontSize: "11px", color: "#475569" }}></span>
                      ) : status === "connected" ? (
                        // Connected — show Unlink button with confirmation
                        unlinkConfirmId === p.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Unlink?</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlink(p.id, p.full_name);
                              }}
                              disabled={unlinking}
                              style={{
                                padding: "4px 10px",
                                background: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: "5px",
                                fontWeight: 600,
                                fontSize: "11px",
                                cursor: "pointer",
                                opacity: unlinking ? 0.5 : 1,
                              }}
                            >
                              {unlinking ? "…" : "Yes"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUnlinkConfirmId(null);
                              }}
                              style={{
                                padding: "4px 10px",
                                background: "transparent",
                                color: "#64748b",
                                border: "1px solid #334155",
                                borderRadius: "5px",
                                fontWeight: 500,
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnlinkConfirmId(p.id);
                            }}
                            style={{
                              padding: "5px 12px",
                              background: "transparent",
                              color: "#a78bfa",
                              border: "1px solid #334155",
                              borderRadius: "6px",
                              fontWeight: 500,
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            Unlink
                          </button>
                        )
                      ) : status === "sent" ? (
                        <span style={{ fontSize: "11px", color: "#f59e0b" }}>Invited</span>
                      ) : status === "received" ? (
                        <span style={{ fontSize: "11px", color: "#22c55e" }}>Respond</span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sendInvitation(p.id);
                          }}
                          disabled={inviteSending === p.id}
                          style={{
                            padding: "5px 12px",
                            background: "#a78bfa",
                            color: "#0f172a",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "11px",
                            cursor: "pointer",
                            opacity: inviteSending === p.id ? 0.5 : 1,
                          }}
                        >
                          {inviteSending === p.id ? "…" : "Invite to Link"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ COMPANIES TAB ═══ */}
        {tab === "companies" && (
          <>
            <div style={{ marginBottom: "12px" }}>
              <input
                type="text"
                placeholder="Search companies…"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {filteredCompanies.length === 0 && (
                <div style={{ textAlign: "center", color: "#475569", padding: "40px 0", fontSize: "14px" }}>
                  {companySearch ? "No companies match your search." : "No companies yet."}
                </div>
              )}
              {filteredCompanies.map((c) => (
                <div
                  key={c.company}
                  onClick={() => router.push(`/companies/${slugify(c.company)}`)}
                  style={{
                    padding: "14px 16px",
                    background: "#1e293b",
                    borderRadius: "10px",
                    border: "1px solid transparent",
                    transition: "background 0.15s",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
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
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>{c.company}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      {c.user_count} {c.user_count === 1 ? "person" : "people"}
                    </span>
                    <span style={{ color: "#475569", fontSize: "12px" }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══ INVITATIONS TAB ═══ */}
        {tab === "invitations" && (
          <>
            {/* Received invitations */}
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", marginBottom: "10px" }}>
              Received
              {pendingReceivedCount > 0 && (
                <span style={{ color: "#ef4444", marginLeft: "6px" }}>({pendingReceivedCount} pending)</span>
              )}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
              {receivedInvitations.length === 0 && (
                <div style={{ textAlign: "center", color: "#475569", padding: "24px 0", fontSize: "13px" }}>
                  No invitations received yet.
                </div>
              )}
              {receivedInvitations.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    background: "#1e293b",
                    borderRadius: "10px",
                    border: inv.status === "pending" ? "1px solid #334155" : "1px solid transparent",
                  }}
                >
                  <div
                    onClick={() => router.push(`/world/${inv.from_user_id}`)}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#94a3b8",
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                  >
                    {initials(inv.from_profile?.full_name || "?")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      onClick={() => router.push(`/world/${inv.from_user_id}`)}
                      style={{ fontWeight: 500, fontSize: "13px", cursor: "pointer" }}
                    >
                      {inv.from_profile?.full_name || "Unknown"}
                    </span>
                    {inv.from_profile?.headline && (
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
                        {inv.from_profile.headline}
                      </div>
                    )}
                    {inv.message && (
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px", fontStyle: "italic" }}>
                        "{inv.message}"
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, display: "flex", gap: "6px" }}>
                    {inv.status === "pending" ? (
                      <>
                        <button
                          onClick={() =>
                            respondToInvitation(inv.id, true, inv.from_user_id, inv.from_profile?.full_name)
                          }
                          disabled={respondingTo === inv.id}
                          style={{
                            padding: "5px 12px",
                            background: "#22c55e",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "11px",
                            cursor: "pointer",
                            opacity: respondingTo === inv.id ? 0.5 : 1,
                          }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => respondToInvitation(inv.id, false)}
                          disabled={respondingTo === inv.id}
                          style={{
                            padding: "5px 12px",
                            background: "transparent",
                            color: "#64748b",
                            border: "1px solid #334155",
                            borderRadius: "6px",
                            fontWeight: 500,
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <span
                        style={{
                          fontSize: "11px",
                          color: inv.status === "accepted" ? "#22c55e" : "#64748b",
                        }}
                      >
                        {inv.status === "accepted" ? "Accepted" : "Declined"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Sent invitations */}
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", marginBottom: "10px" }}>
              Sent
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {sentInvitations.length === 0 && (
                <div style={{ textAlign: "center", color: "#475569", padding: "24px 0", fontSize: "13px" }}>
                  No invitations sent yet.
                </div>
              )}
              {sentInvitations.map((inv) => {
                const target = profiles.find((p) => p.id === inv.to_user_id);
                return (
                  <div
                    key={inv.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      background: "#1e293b",
                      borderRadius: "10px",
                    }}
                  >
                    <div
                      onClick={() => router.push(`/world/${inv.to_user_id}`)}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#334155",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#94a3b8",
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    >
                      {initials(target?.full_name || "?")}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span
                        onClick={() => router.push(`/world/${inv.to_user_id}`)}
                        style={{ fontWeight: 500, fontSize: "13px", cursor: "pointer" }}
                      >
                        {target?.full_name || "Unknown"}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        color:
                          inv.status === "accepted"
                            ? "#22c55e"
                            : inv.status === "declined"
                            ? "#ef4444"
                            : "#f59e0b",
                      }}
                    >
                      {inv.status === "accepted" ? "Accepted" : inv.status === "declined" ? "Declined" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ═══ MERGE PROMPT MODAL ═══ */}
      {mergePrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={() => setMergePrompt(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1e293b",
              borderRadius: "12px",
              border: "1px solid #334155",
              padding: "24px",
              maxWidth: "440px",
              width: "100%",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 6px", color: "#e2e8f0" }}>
              Possible duplicate contact
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px" }}>
              You just linked with a NEXUS profile. You may already have a contact card for this person.
            </p>

            {/* Linked profile info */}
            <div
              style={{
                background: "#0f172a",
                borderRadius: "8px",
                padding: "12px 14px",
                marginBottom: "12px",
                border: "1px solid #334155",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Linked profile
              </div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>
                {mergePrompt.linkedProfile.full_name}
              </div>
              {mergePrompt.linkedProfile.headline && (
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                  {mergePrompt.linkedProfile.headline}
                </div>
              )}
              {mergePrompt.linkedProfile.location && (
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  {mergePrompt.linkedProfile.location}
                </div>
              )}
              <button
                onClick={() => router.push(`/world/${mergePrompt.linkedProfileId}`)}
                style={{
                  marginTop: "8px",
                  padding: "4px 10px",
                  background: "transparent",
                  color: "#a78bfa",
                  border: "1px solid #334155",
                  borderRadius: "5px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                View Resume
              </button>
            </div>

            {/* Existing contact matches */}
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Your existing contact{mergePrompt.existingContacts.length > 1 ? "s" : ""} with this name
            </div>
            {mergePrompt.existingContacts.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "#0f172a",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  marginBottom: "8px",
                  border: "1px solid #334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0" }}>
                    {c.full_name}
                  </div>
                  {(c.role || c.company) && (
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                      {[c.role, c.company].filter(Boolean).join(" at ")}
                    </div>
                  )}
                  {c.location && (
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
                      {c.location}
                    </div>
                  )}
                  {c.email && (
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
                      {c.email}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleMerge(c.id)}
                  disabled={merging}
                  style={{
                    padding: "6px 14px",
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "11px",
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity: merging ? 0.5 : 1,
                  }}
                >
                  {merging ? "..." : "Yes, same person"}
                </button>
              </div>
            ))}

            <button
              onClick={() => setMergePrompt(null)}
              style={{
                marginTop: "8px",
                width: "100%",
                padding: "8px",
                background: "transparent",
                color: "#64748b",
                border: "1px solid #334155",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              No, keep them separate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
