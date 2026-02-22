"use client";

import React from "react";
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

export default function ResumeView({
  linkedProfile,
  linkedWork,
  linkedChronicle,
  linkedEducation,
  contact,
}: ResumeViewProps) {
  const projectEntries = linkedChronicle.filter(
    (e) => e.canvas_col === "project" || e.canvas_col === "projects"
  );
  const educationChronicle = linkedChronicle.filter(
    (e) => e.canvas_col === "education"
  );
  const otherEntries = linkedChronicle.filter(
    (e) =>
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

      {/* Experience */}
      {linkedWork.length > 0 && (
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
                marginBottom: i < linkedWork.length - 1 ? "14px" : 0,
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

      {/* Projects */}
      {(projectEntries.length > 0 || otherEntries.length > 0) && (
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
          {[...projectEntries, ...otherEntries].map((entry, i, arr) => (
            <div
              key={entry.id}
              style={{ marginBottom: i < arr.length - 1 ? "14px" : 0 }}
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
