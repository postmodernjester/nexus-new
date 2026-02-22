import React from "react";

export const REL_TYPES = [
  "None",
  "Acquaintance",
  "Business Contact",
  "Work-Friend",
  "Close Friend",
  "Family",
];

export function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatWorkDate(d: string) {
  if (!d) return "";
  const parts = d.split("-");
  const year = parts[0] || "";
  const month = parts[1] ? parseInt(parts[1]) : 0;
  if (!year) return "";
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!month) return year;
  return `${months[month]} ${year}`;
}

export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// Detect URLs in text and render as clickable links
export function renderContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//)) {
      let domain = "";
      try {
        domain = new URL(part).hostname.replace("www.", "");
      } catch {
        domain = part;
      }
      return React.createElement(
        "a",
        {
          key: i,
          href: part,
          target: "_blank",
          rel: "noopener noreferrer",
          style: {
            color: "#60a5fa",
            textDecoration: "none",
            borderBottom: "1px solid rgba(96,165,250,0.3)",
            wordBreak: "break-all" as const,
          },
        },
        domain,
        React.createElement(
          "span",
          { style: { fontSize: "10px", marginLeft: "3px", opacity: 0.5 } },
          "\u2197"
        )
      );
    }
    return React.createElement("span", { key: i }, part);
  });
}

// Extract URLs from text
export function extractUrls(text: string): string[] {
  const matches = text.match(/(https?:\/\/[^\s<]+)/g);
  return matches || [];
}
