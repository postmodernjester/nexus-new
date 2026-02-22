"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { s } from "../styles";
import type {
  Contact,
  LinkedProfile,
  LinkedWorkEntry,
  LinkedChronicleEntry,
  LinkedEducationEntry,
} from "../types";

interface SynergySectionProps {
  contact: Contact;
  linkedProfile: LinkedProfile | null;
  linkedWork: LinkedWorkEntry[];
  linkedChronicle: LinkedChronicleEntry[];
  linkedEducation: LinkedEducationEntry[];
}

interface SynergyData {
  helpThem: string;
  helpMe: string;
  commonGround: string;
}

export default function SynergySection({
  contact,
  linkedProfile,
  linkedWork,
  linkedChronicle,
  linkedEducation,
}: SynergySectionProps) {
  const [synergy, setSynergy] = useState<SynergyData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function generateSynergy() {
    setGenerating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // Fetch my profile
      const { data: myProfileData } = await supabase
        .from("profiles")
        .select("full_name, headline, bio, location")
        .eq("id", user.id)
        .single();

      // Fetch my skills
      const { data: mySkillsData } = await supabase
        .from("skills")
        .select("name, category")
        .eq("user_id", user.id);

      // Fetch my work
      const { data: myWorkData } = await supabase
        .from("work_entries")
        .select("title, company, description, start_date, end_date, is_current")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });

      // Fetch my education
      const { data: myEduData } = await supabase
        .from("education")
        .select("institution, degree, field_of_study, start_date, end_date")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });

      const myProfile = [
        myProfileData?.full_name && `Name: ${myProfileData.full_name}`,
        myProfileData?.headline && `Headline: ${myProfileData.headline}`,
        myProfileData?.bio && `Bio: ${myProfileData.bio}`,
        myProfileData?.location && `Location: ${myProfileData.location}`,
      ].filter(Boolean).join("\n") || "No profile data";

      const mySkills = mySkillsData && mySkillsData.length > 0
        ? mySkillsData.map(sk => sk.category ? `${sk.name} (${sk.category})` : sk.name).join(", ")
        : "None listed";

      const myWork = myWorkData && myWorkData.length > 0
        ? myWorkData.map(w => `${w.title} at ${w.company}${w.is_current ? ' (current)' : ''}: ${w.description || 'no description'}`).join("\n")
        : "None listed";

      const myEducation = myEduData && myEduData.length > 0
        ? myEduData.map(e => `${e.institution} — ${[e.degree, e.field_of_study].filter(Boolean).join(" in ")}`).join("\n")
        : "None listed";

      const contactInfo = [
        `Name: ${linkedProfile?.full_name || contact.full_name}`,
        linkedProfile?.headline && `Headline: ${linkedProfile.headline}`,
        linkedProfile?.bio && `Bio: ${linkedProfile.bio}`,
        (linkedProfile?.location || contact.location) && `Location: ${linkedProfile?.location || contact.location}`,
        contact.role && `Role: ${contact.role}`,
        contact.company && `Company: ${contact.company}`,
        contact.relationship_type && `Relationship: ${contact.relationship_type}`,
      ].filter(Boolean).join("\n");

      const contactWorkStr = linkedWork.length > 0
        ? linkedWork.map(w => `${w.title}${w.company ? ` at ${w.company}` : ''}${w.is_current ? ' (current)' : ''}: ${w.description || 'no description'}`).join("\n")
        : "None listed";

      const contactEduStr = linkedEducation.length > 0
        ? linkedEducation.map(e => `${e.institution} — ${[e.degree, e.field_of_study].filter(Boolean).join(" in ")}`).join("\n")
        : "None listed";

      const contactChronicleStr = linkedChronicle.length > 0
        ? linkedChronicle.map(c => `${c.title} (${c.canvas_col}): ${c.description || c.note || 'no description'}`).join("\n")
        : "None listed";

      const response = await fetch("/api/ai/synergy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myProfile,
          mySkills,
          myWork,
          myEducation,
          contactInfo,
          contactWork: contactWorkStr,
          contactEducation: contactEduStr,
          contactChronicle: contactChronicleStr,
        }),
      });

      if (!response.ok) throw new Error("API returned " + response.status);

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setSynergy({
        helpThem: data.helpThem || "",
        helpMe: data.helpMe || "",
        commonGround: data.commonGround || "",
      });
    } catch (e: any) {
      console.error("Synergy generation error:", e);
      setError(e.message || "Failed to generate synergy analysis");
    }

    setGenerating(false);
  }

  const subheadStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    color: "#a78bfa",
    marginBottom: "6px",
  };

  const paraStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "13.5px",
    lineHeight: "1.7",
    color: "#cbd5e1",
  };

  return (
    <div
      style={{
        ...s.card,
        borderColor: "rgba(167,139,250,0.25)",
        background: "linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: synergy && !collapsed ? "16px" : "0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px" }}>&#9876;</span>
          <span
            style={{
              ...s.sectionLabel,
              marginBottom: 0,
              color: "#a78bfa",
              fontSize: "12px",
              letterSpacing: "1px",
            }}
          >
            Synergy
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {synergy && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                ...s.btnSecondary,
                fontSize: "11px",
                padding: "4px 12px",
              }}
            >
              {collapsed ? "Show" : "Hide"}
            </button>
          )}
          <button
            onClick={generateSynergy}
            disabled={generating}
            style={{
              ...s.btnSecondary,
              fontSize: "11px",
              padding: "4px 12px",
              opacity: generating ? 0.5 : 1,
              borderColor: "rgba(167,139,250,0.3)",
              color: "#a78bfa",
            }}
          >
            {generating
              ? "Analyzing…"
              : synergy
                ? "Regenerate"
                : "Analyze"}
          </button>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: "12px", color: "#f87171", margin: "8px 0 0" }}>
          {error}
        </p>
      )}

      {!synergy && !generating && !error && (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: "13px",
            color: "#475569",
            fontStyle: "italic",
          }}
        >
          Click Analyze to discover potential synergies between you and{" "}
          {linkedProfile?.full_name || contact.full_name}. The AI will compare
          your skills, experience, and background to find ways you could help
          each other and topics for conversation.
        </p>
      )}

      {synergy && !collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {synergy.helpThem && (
            <div>
              <div style={subheadStyle}>How I Could Help Them</div>
              <p style={paraStyle}>{synergy.helpThem}</p>
            </div>
          )}
          {synergy.helpMe && (
            <div>
              <div style={subheadStyle}>How They Might Help Me</div>
              <p style={paraStyle}>{synergy.helpMe}</p>
            </div>
          )}
          {synergy.commonGround && (
            <div>
              <div style={subheadStyle}>Common Ground for Conversation</div>
              <p style={paraStyle}>{synergy.commonGround}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
