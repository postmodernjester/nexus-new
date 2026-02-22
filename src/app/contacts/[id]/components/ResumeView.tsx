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
} from "../types";

interface ResumeViewProps {
  linkedProfile: LinkedProfile;
  linkedWork: LinkedWorkEntry[];
  linkedChronicle: LinkedChronicleEntry[];
  linkedEducation: LinkedEducationEntry[];
  contact: Contact;
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
function ProjectTile({ entry, idx }: { entry: LinkedChronicleEntry; idx: number }) {
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
  linkedWork,
  linkedChronicle,
  linkedEducation,
  contact,
}: ResumeViewProps) {
  // Work-type chronicle entries belong in Experience, not Projects
  const workChronicle = linkedChronicle.filter(
    (e) => e.canvas_col === "work"
  );
  const projectEntries = linkedChronicle.filter(
    (e) => e.canvas_col === "project" || e.canvas_col === "projects"
  );
  const educationChronicle = linkedChronicle.filter(
    (e) => e.canvas_col === "education"
  );
  // "Other" means non-work, non-project, non-education chronicle entries → show as projects
  const otherEntries = linkedChronicle.filter(
    (e) =>
      e.canvas_col !== "work" &&
      e.canvas_col !== "project" &&
      e.canvas_col !== "projects" &&
      e.canvas_col !== "education"
  );
  const visibleLinks =
    linkedProfile.key_links?.filter((l) => l.url && l.visible) || [];
  const linkLabels: Record<string, string> = {
    linkedin: "LinkedIn",
    wikipedia: "Wikipedia",
    twitter: "X / Twitter",
    github: "GitHub",
    website: "Website",
  };

  const allProjects = [...projectEntries, ...otherEntries];
  const hasExperience = linkedWork.length > 0 || workChronicle.length > 0;

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
        {linkedProfile.profile_photo_url && (
          <div style={{
            width: 72, height: 72, borderRadius: 8,
            overflow: "hidden", margin: "0 auto 12px",
            border: "2px solid #ddd",
          }}>
            <img
              src={linkedProfile.profile_photo_url}
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
          {linkedProfile.full_name}
        </h2>
        {linkedProfile.headline && (
          <div
            style={{
              fontSize: "13px",
              color: "#555",
              marginBottom: "6px",
              fontStyle: "italic",
            }}
          >
            {linkedProfile.headline}
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
          {linkedProfile.location && <span>{linkedProfile.location}</span>}
          {linkedProfile.website && (
            <a
              href={linkedProfile.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#3b5998", textDecoration: "none" }}
            >
              {(() => {
                try {
                  return new URL(linkedProfile.website!).hostname.replace(
                    "www.",
                    ""
                  );
                } catch {
                  return linkedProfile.website;
                }
              })()}
            </a>
          )}
          {contact.email && <span>{contact.email}</span>}
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
      </div>

      {/* Bio */}
      {linkedProfile.bio && (
        <div
          style={{
            marginBottom: "20px",
            fontSize: "13px",
            lineHeight: "1.7",
            color: "#333",
            fontStyle: "italic",
          }}
        >
          {linkedProfile.bio}
        </div>
      )}

      {/* Experience — traditional resume format (work_entries + work-type chronicle) */}
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
          {linkedWork.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                marginBottom: i < linkedWork.length - 1 || workChronicle.length > 0 ? "14px" : 0,
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
                marginBottom: i < workChronicle.length - 1 ? "14px" : 0,
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
      {(linkedEducation.length > 0 || educationChronicle.length > 0) && (
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
          {linkedEducation.map((edu, i) => (
            <div
              key={edu.id}
              style={{
                marginBottom:
                  i < linkedEducation.length - 1 ||
                  educationChronicle.length > 0
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
                  i < educationChronicle.length - 1 ? "14px" : 0,
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
        </div>
      )}
    </div>
  );
}
