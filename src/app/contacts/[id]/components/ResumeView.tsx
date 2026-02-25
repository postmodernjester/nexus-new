"use client";

import React from "react";
import { useState } from "react";
import { formatWorkDate } from "../utils";
import type {
  Contact,
  LinkedProfile,
  LinkedWorkEntry,
  LinkedChronicleEntry,
  LinkedEducationEntry,
  ResumeData,
  ResumeDataChronicle,
} from "../types";

interface ResumeViewProps {
  linkedProfile?: LinkedProfile | null;
  linkedWork?: LinkedWorkEntry[];
  linkedChronicle?: LinkedChronicleEntry[];
  linkedEducation?: LinkedEducationEntry[];
  contact: Contact;
  parsedResume?: ResumeData | null;
  onUploadResume?: () => void;
  onClearResume?: () => void;
}

/* ── Pastel palette for project tiles ── */
const TILE_COLORS = [
  "#508038", "#4070a8", "#a85060", "#806840",
  "#7050a8", "#2a8a6a", "#c06848", "#986020",
];

function tileColor(idx: number) {
  return TILE_COLORS[idx % TILE_COLORS.length];
}

/* ── Project tile (square card with image or color, hover for details) ── */
function ProjectTile({ entry, idx }: { entry: LinkedChronicleEntry | ResumeDataChronicle; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const color = tileColor(idx);
  const dateStr = `${formatWorkDate(entry.start_date || "")}${entry.end_date ? ` – ${formatWorkDate(entry.end_date)}` : ""}`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: 140,
        minHeight: 140,
        borderRadius: 10,
        overflow: "hidden",
        background: entry.image_url ? "none" : `linear-gradient(135deg, ${color}18, ${color}30)`,
        border: `1.5px solid ${color}44`,
        cursor: "default",
        transition: "transform 0.2s, box-shadow 0.2s",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? `0 6px 20px ${color}22` : "none",
        flexShrink: 0,
      }}
    >
      {/* Image or color block */}
      <div style={{ width: "100%", height: 70, overflow: "hidden", position: "relative" }}>
        {entry.image_url ? (
          <img src={entry.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${color}22, ${color}44)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: `${color}33`, border: `2px solid ${color}88`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color, fontWeight: 700,
            }}>
              {entry.title.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 11.5, fontWeight: 700, color: "#1a1a2e",
        textAlign: "center", padding: "8px 10px 0",
        lineHeight: 1.3,
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
      }}>
        {entry.title}
      </div>

      {/* Date */}
      <div style={{
        fontSize: 9, color: "#999",
        textAlign: "center", padding: "4px 10px 12px",
        fontFamily: "sans-serif",
      }}>
        {dateStr}
      </div>

      {/* Hover overlay */}
      {hovered && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(250,249,246,0.97)",
          padding: "12px 14px",
          overflowY: "auto",
          zIndex: 5,
          borderRadius: 10,
        }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: "#1a1a2e", marginBottom: 3 }}>
            {entry.title}
          </div>
          <div style={{ fontSize: 10, color: "#888", fontFamily: "sans-serif", marginBottom: 6 }}>
            {dateStr}
          </div>
          {(entry.description || entry.note) && (
            <p style={{ fontSize: 10.5, lineHeight: 1.5, color: "#444", margin: 0, whiteSpace: "pre-wrap" }}>
              {entry.description || entry.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResumeView({
  linkedProfile,
  linkedWork = [],
  linkedChronicle = [],
  linkedEducation = [],
  contact,
  parsedResume,
  onUploadResume,
  onClearResume,
}: ResumeViewProps) {
  // Determine if we're showing live linked data vs snapshot/uploaded data
  const isLinked = !!linkedProfile;

  // Chronicle entries (live or from snapshot)
  const activeChronicle: (LinkedChronicleEntry | ResumeDataChronicle)[] = isLinked
    ? linkedChronicle
    : (parsedResume?.chronicle || []);

  // Work-type chronicle entries belong in Experience, not Projects
  const workChronicle = activeChronicle.filter(
    (e) => e.canvas_col === "work"
  );
  const projectEntries = activeChronicle.filter(
    (e) => e.canvas_col === "project" || e.canvas_col === "projects"
  );
  const educationChronicle = activeChronicle.filter(
    (e) => e.canvas_col === "education"
  );
  // "Other" means non-work, non-project, non-education chronicle entries → show as projects
  const otherEntries = activeChronicle.filter(
    (e) =>
      e.canvas_col !== "work" &&
      e.canvas_col !== "project" &&
      e.canvas_col !== "projects" &&
      e.canvas_col !== "education"
  );

  // Profile data: prefer live linked, then snapshot, then contact fields
  const activeProfile = linkedProfile || parsedResume?.profile || null;
  const visibleLinks =
    activeProfile?.key_links?.filter((l) => l.url && l.visible) || [];
  const linkLabels: Record<string, string> = {
    linkedin: "LinkedIn",
    wikipedia: "Wikipedia",
    twitter: "X / Twitter",
    github: "GitHub",
    website: "Website",
  };

  const allProjects = [...projectEntries, ...otherEntries];

  // When linked, show live data only — UNLESS the user manually uploaded
  // resume data (indicated by raw_text), in which case prefer the upload.
  const hasManualUpload = !!parsedResume?.raw_text;
  const activeWork = isLinked && !hasManualUpload ? linkedWork : [];
  const activeEducation = isLinked && !hasManualUpload ? linkedEducation : [];
  const parsedWork = isLinked && !hasManualUpload ? [] : (parsedResume?.work || []);
  const parsedEdu = isLinked && !hasManualUpload ? [] : (parsedResume?.education || []);

  const hasExperience = activeWork.length > 0 || workChronicle.length > 0 || parsedWork.length > 0;
  const hasEducation = activeEducation.length > 0 || educationChronicle.length > 0 || parsedEdu.length > 0;

  const profileName = activeProfile?.full_name || contact.full_name;
  const hasAnyData = hasExperience || hasEducation || allProjects.length > 0;

  return (
    <div
      style={{
        background: "#faf9f6",
        borderRadius: "12px",
        padding: "36px 40px",
        marginBottom: "16px",
        boxShadow:
          "0 2px 16px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
        color: "#1a1a2e",
        fontFamily: "'Georgia', 'Times New Roman', serif",
      }}
    >
      {/* Resume header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "24px",
          borderBottom: "2px solid #2d2d44",
          paddingBottom: "20px",
        }}
      >
        {/* Profile photo */}
        {activeProfile?.profile_photo_url && (
          <div style={{
            width: 72, height: 72, borderRadius: 8,
            overflow: "hidden", margin: "0 auto 12px",
            border: "2px solid #ddd",
          }}>
            <img
              src={activeProfile.profile_photo_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
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
          {profileName}
        </h2>
        {activeProfile?.headline && (
          <div
            style={{
              fontSize: "13px",
              color: "#555",
              marginBottom: "6px",
              fontStyle: "italic",
            }}
          >
            {activeProfile.headline}
          </div>
        )}
        {!activeProfile?.headline && (contact.role || contact.company) && (
          <div
            style={{
              fontSize: "13px",
              color: "#555",
              marginBottom: "6px",
              fontStyle: "italic",
            }}
          >
            {[contact.role, contact.company].filter(Boolean).join(" at ")}
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
          {(activeProfile?.location || contact.location) && (
            <span>{activeProfile?.location || contact.location}</span>
          )}
          {activeProfile?.website && (
            <a
              href={activeProfile.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#3b5998", textDecoration: "none" }}
            >
              {(() => {
                try {
                  return new URL(activeProfile.website!).hostname.replace(
                    "www.",
                    ""
                  );
                } catch {
                  return activeProfile.website;
                }
              })()}
            </a>
          )}
        </div>
        {visibleLinks.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              marginTop: "8px",
              flexWrap: "wrap",
            }}
          >
            {visibleLinks.map((link) => (
              <a
                key={link.type}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "11px",
                  color: "#3b5998",
                  textDecoration: "none",
                  borderBottom: "1px dotted #aaa",
                }}
              >
                {linkLabels[link.type] || link.type}
              </a>
            ))}
          </div>
        )}

        {/* Upload / Re-parse buttons */}
        {(onUploadResume || onClearResume) && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
            {onUploadResume && (
              <button
                onClick={onUploadResume}
                style={{
                  padding: "4px 12px",
                  background: "transparent",
                  color: "#888",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "sans-serif",
                }}
              >
                {hasAnyData ? "Re-parse Resume" : "Upload Resume"}
              </button>
            )}
            {onClearResume && parsedResume && (
              <button
                onClick={onClearResume}
                style={{
                  padding: "4px 12px",
                  background: "transparent",
                  color: "#c88",
                  border: "1px solid #dcc",
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "sans-serif",
                }}
              >
                Clear Parsed
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bio */}
      {activeProfile?.bio && (
        <div
          style={{
            marginBottom: "20px",
            fontSize: "13px",
            lineHeight: "1.7",
            color: "#333",
            fontStyle: "italic",
          }}
        >
          {activeProfile.bio}
        </div>
      )}

      {/* Experience — traditional resume format (work_entries + work-type chronicle + parsed) */}
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
          {activeWork.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                marginBottom: i < activeWork.length - 1 || workChronicle.length > 0 || parsedWork.length > 0 ? "14px" : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#1a1a2e",
                  }}
                >
                  {entry.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    fontFamily: "sans-serif",
                  }}
                >
                  {formatWorkDate(entry.start_date || "")} –{" "}
                  {entry.is_current
                    ? "Present"
                    : formatWorkDate(entry.end_date || "")}
                </div>
              </div>
              {(entry.company || entry.location) && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "#555",
                    fontStyle: "italic",
                  }}
                >
                  {entry.company}
                  {entry.location ? ` — ${entry.location}` : ""}
                  {entry.engagement_type &&
                  entry.engagement_type !== "full-time"
                    ? ` (${entry.engagement_type})`
                    : ""}
                </div>
              )}
              {entry.description && (
                <p
                  style={{
                    fontSize: "12.5px",
                    lineHeight: "1.6",
                    color: "#444",
                    margin: "6px 0 0",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {entry.description}
                </p>
              )}
            </div>
          ))}
          {/* Work-type chronicle entries also render as resume line items */}
          {workChronicle.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                marginBottom: i < workChronicle.length - 1 || parsedWork.length > 0 ? "14px" : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#1a1a2e",
                  }}
                >
                  {entry.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    fontFamily: "sans-serif",
                  }}
                >
                  {formatWorkDate(entry.start_date || "")}
                  {entry.end_date
                    ? ` – ${formatWorkDate(entry.end_date)}`
                    : " – Present"}
                </div>
              </div>
              {(entry.description || entry.note) && (
                <p
                  style={{
                    fontSize: "12.5px",
                    lineHeight: "1.6",
                    color: "#444",
                    margin: "6px 0 0",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {entry.description || entry.note}
                </p>
              )}
            </div>
          ))}
          {/* Parsed resume work entries */}
          {parsedWork.map((entry, i) => (
            <div
              key={`parsed-w-${i}`}
              style={{
                marginBottom: i < parsedWork.length - 1 ? "14px" : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#1a1a2e",
                  }}
                >
                  {entry.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    fontFamily: "sans-serif",
                  }}
                >
                  {formatWorkDate(entry.start_date || "")} –{" "}
                  {entry.is_current
                    ? "Present"
                    : formatWorkDate(entry.end_date || "")}
                </div>
              </div>
              {(entry.company || entry.location) && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "#555",
                    fontStyle: "italic",
                  }}
                >
                  {entry.company}
                  {entry.location ? ` — ${entry.location}` : ""}
                  {entry.engagement_type &&
                  entry.engagement_type !== "full-time"
                    ? ` (${entry.engagement_type})`
                    : ""}
                </div>
              )}
              {entry.description && (
                <p
                  style={{
                    fontSize: "12.5px",
                    lineHeight: "1.6",
                    color: "#444",
                    margin: "6px 0 0",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {entry.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Projects — visual tiles */}
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
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}>
            {allProjects.map((entry, i) => (
              <ProjectTile key={entry.id} entry={entry} idx={i} />
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {hasEducation && (
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
          {activeEducation.map((edu, i) => (
            <div
              key={edu.id}
              style={{
                marginBottom:
                  i < activeEducation.length - 1 ||
                  educationChronicle.length > 0 ||
                  parsedEdu.length > 0
                    ? "14px"
                    : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#1a1a2e",
                  }}
                >
                  {edu.institution}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    fontFamily: "sans-serif",
                  }}
                >
                  {formatWorkDate(edu.start_date || "")} –{" "}
                  {edu.is_current
                    ? "Present"
                    : formatWorkDate(edu.end_date || "")}
                </div>
              </div>
              {(edu.degree || edu.field_of_study) && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "#555",
                    fontStyle: "italic",
                  }}
                >
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(" in ")}
                </div>
              )}
            </div>
          ))}
          {educationChronicle.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                marginBottom:
                  i < educationChronicle.length - 1 || parsedEdu.length > 0 ? "14px" : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#1a1a2e",
                  }}
                >
                  {entry.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    fontFamily: "sans-serif",
                  }}
                >
                  {formatWorkDate(entry.start_date || "")}
                  {entry.end_date
                    ? ` – ${formatWorkDate(entry.end_date)}`
                    : ""}
                </div>
              </div>
              {(entry.description || entry.note) && (
                <p
                  style={{
                    fontSize: "12.5px",
                    lineHeight: "1.6",
                    color: "#444",
                    margin: "6px 0 0",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {entry.description || entry.note}
                </p>
              )}
            </div>
          ))}
          {/* Parsed resume education entries */}
          {parsedEdu.map((edu, i) => (
            <div
              key={`parsed-e-${i}`}
              style={{
                marginBottom: i < parsedEdu.length - 1 ? "14px" : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#1a1a2e",
                  }}
                >
                  {edu.institution}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    fontFamily: "sans-serif",
                  }}
                >
                  {edu.start_date ? formatWorkDate(edu.start_date) : ""}
                  {edu.end_date
                    ? ` – ${formatWorkDate(edu.end_date)}`
                    : edu.is_current
                    ? " – Present"
                    : ""}
                </div>
              </div>
              {(edu.degree || edu.field_of_study) && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "#555",
                    fontStyle: "italic",
                  }}
                >
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(" in ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state with upload prompt */}
      {!hasAnyData && onUploadResume && (
        <div style={{
          textAlign: "center",
          padding: "20px 0",
          color: "#999",
          fontSize: 13,
          fontFamily: "sans-serif",
        }}>
          No resume data yet. Upload a PDF or paste from LinkedIn to populate.
        </div>
      )}
    </div>
  );
}
