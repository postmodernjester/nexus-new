"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";

interface Profile {
  id: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar_url: string | null;
  profile_photo_url: string | null;
  key_links: { type: string; url: string; visible: boolean }[] | null;
}

interface WorkEntry {
  id: string;
  title: string;
  company: string | null;
  engagement_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  location: string | null;
}

interface EducationEntry {
  id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

interface ChronicleEntry {
  id: string;
  type: string;
  title: string;
  start_date: string;
  end_date: string | null;
  canvas_col: string;
  note: string | null;
  description: string | null;
  image_url: string | null;
}

const TILE_COLORS = [
  "#508038", "#4070a8", "#a85060", "#806840",
  "#7050a8", "#2a8a6a", "#c06848", "#986020",
];

const LINK_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  wikipedia: "Wikipedia",
  twitter: "X / Twitter",
  github: "GitHub",
  website: "Website",
};

function formatWorkDate(d: string) {
  if (!d) return "";
  const parts = d.split("-");
  const year = parts[0] || "";
  const month = parts[1] ? parseInt(parts[1]) : 0;
  if (!year) return "";
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!month) return year;
  return `${months[month]} ${year}`;
}

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams();
  const targetUserId = params.userId as string;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [work, setWork] = useState<WorkEntry[]>([]);
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkStatus, setLinkStatus] = useState<"connected" | "sent" | "received" | "self" | "none">("none");
  const [inviteSending, setInviteSending] = useState(false);
  const [receivedInvitationId, setReceivedInvitationId] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [targetUserId]);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setCurrentUserId(user.id);

    if (user.id === targetUserId) {
      setLinkStatus("self");
    }

    const [profileRes, workRes, eduRes, chronicleRes, connectionsRes, sentInvRes, recvInvRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, headline, bio, location, website, avatar_url, profile_photo_url, key_links")
          .eq("id", targetUserId)
          .single(),
        supabase
          .from("work_entries")
          .select("id, title, company, engagement_type, start_date, end_date, is_current, description, location")
          .eq("user_id", targetUserId)
          .order("start_date", { ascending: false }),
        supabase
          .from("education")
          .select("id, institution, degree, field_of_study, start_date, end_date, is_current")
          .eq("user_id", targetUserId)
          .order("start_date", { ascending: false }),
        supabase
          .from("chronicle_entries")
          .select("id, type, title, start_date, end_date, canvas_col, note, description, image_url")
          .eq("user_id", targetUserId)
          .eq("show_on_resume", true)
          .order("start_date", { ascending: false }),
        supabase
          .from("connections")
          .select("id")
          .eq("status", "accepted")
          .or(
            `and(inviter_id.eq.${user.id},invitee_id.eq.${targetUserId}),and(inviter_id.eq.${targetUserId},invitee_id.eq.${user.id})`
          ),
        supabase
          .from("link_invitations")
          .select("id")
          .eq("from_user_id", user.id)
          .eq("to_user_id", targetUserId)
          .eq("status", "pending"),
        supabase
          .from("link_invitations")
          .select("id")
          .eq("from_user_id", targetUserId)
          .eq("to_user_id", user.id)
          .eq("status", "pending"),
      ]);

    setProfile(profileRes.data as Profile | null);
    setWork(workRes.data || []);
    setEducation(eduRes.data || []);
    setChronicle(chronicleRes.data || []);

    if (user.id !== targetUserId) {
      if ((connectionsRes.data || []).length > 0) {
        setLinkStatus("connected");
      } else if ((sentInvRes.data || []).length > 0) {
        setLinkStatus("sent");
      } else if ((recvInvRes.data || []).length > 0) {
        setLinkStatus("received");
        setReceivedInvitationId(recvInvRes.data![0].id);
      } else {
        setLinkStatus("none");
      }
    }

    setLoading(false);
  }

  async function sendInvitation() {
    if (!currentUserId) return;
    setInviteSending(true);
    const { error } = await supabase.from("link_invitations").insert({
      from_user_id: currentUserId,
      to_user_id: targetUserId,
    });
    if (!error) setLinkStatus("sent");
    setInviteSending(false);
  }

  async function respondToInvitation(accept: boolean) {
    if (!receivedInvitationId) return;
    setRespondingTo(true);
    if (accept) {
      const { data } = await supabase.rpc("accept_link_invitation", {
        p_invitation_id: receivedInvitationId,
      });
      if (data?.success) setLinkStatus("connected");
    } else {
      await supabase
        .from("link_invitations")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", receivedInvitationId);
      setLinkStatus("none");
    }
    setRespondingTo(false);
  }

  // Categorize chronicle entries
  const workChronicle = chronicle.filter((e) => e.canvas_col === "work");
  const projectEntries = chronicle.filter(
    (e) => e.canvas_col === "project" || e.canvas_col === "projects"
  );
  const educationChronicle = chronicle.filter((e) => e.canvas_col === "education");
  const otherEntries = chronicle.filter(
    (e) =>
      e.canvas_col !== "work" &&
      e.canvas_col !== "project" &&
      e.canvas_col !== "projects" &&
      e.canvas_col !== "education"
  );
  const allProjects = [...projectEntries, ...otherEntries];
  const hasExperience = work.length > 0 || workChronicle.length > 0;
  const visibleLinks = profile?.key_links?.filter((l) => l.url && l.visible) || [];

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

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
        <Nav />
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Profile not found</h2>
          <p style={{ color: "#64748b", fontSize: "14px" }}>This user may have set their profile to private.</p>
          <button
            onClick={() => router.push("/world")}
            style={{
              marginTop: "16px",
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

  const photo = profile.profile_photo_url || profile.avatar_url;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <Nav />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Back link */}
        <button
          onClick={() => router.push("/world")}
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
          ← Back to World
        </button>

        {/* Link action bar */}
        {linkStatus !== "self" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginBottom: "16px",
              gap: "8px",
            }}
          >
            {linkStatus === "connected" && (
              <span style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 500 }}>
                Linked
              </span>
            )}
            {linkStatus === "sent" && (
              <span style={{ fontSize: "13px", color: "#f59e0b" }}>Invitation sent</span>
            )}
            {linkStatus === "received" && (
              <>
                <span style={{ fontSize: "12px", color: "#94a3b8", marginRight: "4px" }}>
                  Wants to link with you
                </span>
                <button
                  onClick={() => respondToInvitation(true)}
                  disabled={respondingTo}
                  style={{
                    padding: "6px 14px",
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer",
                    opacity: respondingTo ? 0.5 : 1,
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() => respondToInvitation(false)}
                  disabled={respondingTo}
                  style={{
                    padding: "6px 14px",
                    background: "transparent",
                    color: "#64748b",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    fontWeight: 500,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Decline
                </button>
              </>
            )}
            {linkStatus === "none" && (
              <button
                onClick={sendInvitation}
                disabled={inviteSending}
                style={{
                  padding: "8px 20px",
                  background: "#a78bfa",
                  color: "#0f172a",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  opacity: inviteSending ? 0.5 : 1,
                }}
              >
                {inviteSending ? "Sending…" : "Invite to Link"}
              </button>
            )}
          </div>
        )}

        {/* ── Resume card (light background, matching ResumeView style) ── */}
        <div
          style={{
            background: "#faf9f6",
            borderRadius: "12px",
            padding: "36px 40px",
            marginBottom: "16px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
            color: "#1a1a2e",
            fontFamily: "'Georgia', 'Times New Roman', serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "24px",
              borderBottom: "2px solid #2d2d44",
              paddingBottom: "20px",
            }}
          >
            {photo && (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 8,
                  overflow: "hidden",
                  margin: "0 auto 12px",
                  border: "2px solid #ddd",
                }}
              >
                <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                margin: "0 0 4px",
                color: "#1a1a2e",
                letterSpacing: "0.5px",
              }}
            >
              {profile.full_name}
            </h2>
            {profile.headline && (
              <div style={{ fontSize: "13px", color: "#555", marginBottom: "6px", fontStyle: "italic" }}>
                {profile.headline}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "16px",
                flexWrap: "wrap",
                fontSize: "12px",
                color: "#666",
              }}
            >
              {profile.location && <span>{profile.location}</span>}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#3b5998", textDecoration: "none" }}
                >
                  {(() => {
                    try {
                      return new URL(profile.website!).hostname.replace("www.", "");
                    } catch {
                      return profile.website;
                    }
                  })()}
                </a>
              )}
            </div>
            {visibleLinks.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                {visibleLinks.map((link) => (
                  <a
                    key={link.type}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "11px", color: "#3b5998", textDecoration: "none", borderBottom: "1px dotted #aaa" }}
                  >
                    {LINK_LABELS[link.type] || link.type}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div style={{ marginBottom: "20px", fontSize: "13px", lineHeight: "1.7", color: "#333", fontStyle: "italic" }}>
              {profile.bio}
            </div>
          )}

          {/* Experience */}
          {hasExperience && (
            <div style={{ marginBottom: "22px" }}>
              <h3
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "#1a1a2e",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "4px",
                  marginBottom: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                Experience
              </h3>
              {work.map((entry, i) => (
                <div key={entry.id} style={{ marginBottom: i < work.length - 1 || workChronicle.length > 0 ? "14px" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a1a2e" }}>{entry.title}</div>
                    <div style={{ fontSize: "12px", color: "#777", fontFamily: "sans-serif" }}>
                      {formatWorkDate(entry.start_date || "")} –{" "}
                      {entry.is_current ? "Present" : formatWorkDate(entry.end_date || "")}
                    </div>
                  </div>
                  {(entry.company || entry.location) && (
                    <div style={{ fontSize: "13px", color: "#555", fontStyle: "italic" }}>
                      {entry.company}
                      {entry.location ? ` — ${entry.location}` : ""}
                      {entry.engagement_type && entry.engagement_type !== "full-time"
                        ? ` (${entry.engagement_type})`
                        : ""}
                    </div>
                  )}
                  {entry.description && (
                    <p style={{ fontSize: "12.5px", lineHeight: "1.6", color: "#444", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                      {entry.description}
                    </p>
                  )}
                </div>
              ))}
              {workChronicle.map((entry, i) => (
                <div key={entry.id} style={{ marginBottom: i < workChronicle.length - 1 ? "14px" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a1a2e" }}>{entry.title}</div>
                    <div style={{ fontSize: "12px", color: "#777", fontFamily: "sans-serif" }}>
                      {formatWorkDate(entry.start_date || "")}
                      {entry.end_date ? ` – ${formatWorkDate(entry.end_date)}` : " – Present"}
                    </div>
                  </div>
                  {(entry.description || entry.note) && (
                    <p style={{ fontSize: "12.5px", lineHeight: "1.6", color: "#444", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                      {entry.description || entry.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Projects */}
          {allProjects.length > 0 && (
            <div style={{ marginBottom: "22px" }}>
              <h3
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "#1a1a2e",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "4px",
                  marginBottom: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                Projects
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {allProjects.map((entry, i) => {
                  const color = TILE_COLORS[i % TILE_COLORS.length];
                  const dateStr = `${formatWorkDate(entry.start_date || "")}${entry.end_date ? ` – ${formatWorkDate(entry.end_date)}` : ""}`;
                  return (
                    <div
                      key={entry.id}
                      style={{
                        width: 140,
                        minHeight: 140,
                        borderRadius: 10,
                        overflow: "hidden",
                        background: entry.image_url ? "none" : `linear-gradient(135deg, ${color}18, ${color}30)`,
                        border: `1.5px solid ${color}44`,
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ width: "100%", height: 70, overflow: "hidden" }}>
                        {entry.image_url ? (
                          <img src={entry.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              background: `linear-gradient(135deg, ${color}22, ${color}44)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: `${color}33`,
                                border: `2px solid ${color}88`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 16,
                                color,
                                fontWeight: 700,
                              }}
                            >
                              {entry.title.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#1a1a2e",
                          textAlign: "center",
                          padding: "8px 10px 0",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as any,
                        }}
                      >
                        {entry.title}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: "#999",
                          textAlign: "center",
                          padding: "4px 10px 12px",
                          fontFamily: "sans-serif",
                        }}
                      >
                        {dateStr}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Education */}
          {(education.length > 0 || educationChronicle.length > 0) && (
            <div style={{ marginBottom: "22px" }}>
              <h3
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "#1a1a2e",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "4px",
                  marginBottom: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                Education
              </h3>
              {education.map((edu, i) => (
                <div key={edu.id} style={{ marginBottom: i < education.length - 1 || educationChronicle.length > 0 ? "14px" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a1a2e" }}>{edu.institution}</div>
                    <div style={{ fontSize: "12px", color: "#777", fontFamily: "sans-serif" }}>
                      {formatWorkDate(edu.start_date || "")} –{" "}
                      {edu.is_current ? "Present" : formatWorkDate(edu.end_date || "")}
                    </div>
                  </div>
                  {(edu.degree || edu.field_of_study) && (
                    <div style={{ fontSize: "13px", color: "#555", fontStyle: "italic" }}>
                      {[edu.degree, edu.field_of_study].filter(Boolean).join(" in ")}
                    </div>
                  )}
                </div>
              ))}
              {educationChronicle.map((entry, i) => (
                <div key={entry.id} style={{ marginBottom: i < educationChronicle.length - 1 ? "14px" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a1a2e" }}>{entry.title}</div>
                    <div style={{ fontSize: "12px", color: "#777", fontFamily: "sans-serif" }}>
                      {formatWorkDate(entry.start_date || "")}
                      {entry.end_date ? ` – ${formatWorkDate(entry.end_date)}` : ""}
                    </div>
                  </div>
                  {(entry.description || entry.note) && (
                    <p style={{ fontSize: "12.5px", lineHeight: "1.6", color: "#444", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                      {entry.description || entry.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
