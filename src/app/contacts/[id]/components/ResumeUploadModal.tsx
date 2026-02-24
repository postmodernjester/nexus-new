"use client";

import React, { useState, useRef } from "react";

export interface ParsedWork {
  title: string;
  company: string;
  location?: string | null;
  location_type?: string | null;
  engagement_type?: string;
  start_date?: string;
  end_date?: string | null;
  is_current: boolean;
  description?: string | null;
}

export interface ParsedEducation {
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current: boolean;
}

export interface ParsedResumeData {
  work: ParsedWork[];
  education: ParsedEducation[];
  raw_text?: string;
}

interface ResumeUploadModalProps {
  open: boolean;
  personName?: string;
  onClose: () => void;
  onParsed: (data: ParsedResumeData) => void;
}

export default function ResumeUploadModal({
  open,
  personName,
  onClose,
  onParsed,
}: ResumeUploadModalProps) {
  const [mode, setMode] = useState<"paste" | "pdf">("paste");
  const [text, setText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function handleParse() {
    setError("");
    setParsing(true);

    try {
      let body: any = { person_name: personName };

      if (mode === "pdf" && pdfFile) {
        const buffer = await pdfFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        body.pdf_base64 = btoa(binary);
      } else if (mode === "paste" && text.trim()) {
        body.text = text.trim();
      } else {
        setError(mode === "pdf" ? "Please select a PDF file" : "Please paste some text");
        setParsing(false);
        return;
      }

      const res = await fetch("/api/ai/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to parse resume");
        setParsing(false);
        return;
      }

      onParsed({
        work: data.work || [],
        education: data.education || [],
        raw_text: mode === "paste" ? text.trim() : undefined,
      });
    } catch (e: any) {
      setError(e.message || "Network error");
    }

    setParsing(false);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "24px 28px",
          width: 520,
          maxWidth: "92vw",
          maxHeight: "85vh",
          overflowY: "auto",
          color: "#e2e8f0",
          fontFamily: "inherit",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          Upload Resume{personName ? ` — ${personName}` : ""}
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
          {(["paste", "pdf"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1,
                padding: "8px 0",
                background: mode === m ? "#a78bfa" : "transparent",
                color: mode === m ? "#0f172a" : "#94a3b8",
                border: `1px solid ${mode === m ? "#a78bfa" : "#334155"}`,
                borderRadius: m === "paste" ? "6px 0 0 6px" : "0 6px 6px 0",
                fontSize: 13,
                fontWeight: mode === m ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {m === "paste" ? "Paste Text" : "Upload PDF"}
            </button>
          ))}
        </div>

        {mode === "paste" ? (
          <>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
              Paste a LinkedIn profile, resume text, or any career description.
              The AI will extract work history and education.
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Copy from LinkedIn, a resume, or type a career summary...\n\nExample:\nJohn Smith\nSenior Engineer at Acme Corp\nJan 2020 - Present · San Francisco\n\nSoftware Engineer at StartupCo\nMar 2017 - Dec 2019\n..."}
              style={{
                width: "100%",
                minHeight: 200,
                padding: "10px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
              autoFocus
            />
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
              Upload a PDF resume. The AI will read it directly and extract all entries.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%",
                padding: "32px 16px",
                background: "#0f172a",
                border: "2px dashed #334155",
                borderRadius: 8,
                color: pdfFile ? "#a78bfa" : "#64748b",
                fontSize: 14,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {pdfFile ? pdfFile.name : "Click to select PDF..."}
            </button>
          </>
        )}

        {error && (
          <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button
            onClick={onClose}
            disabled={parsing}
            style={{
              padding: "8px 16px",
              background: "transparent",
              color: "#94a3b8",
              border: "1px solid #334155",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            disabled={parsing}
            style={{
              padding: "8px 20px",
              background: parsing ? "#7c6cbf" : "#a78bfa",
              color: "#0f172a",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: parsing ? "wait" : "pointer",
              opacity: parsing ? 0.7 : 1,
            }}
          >
            {parsing ? "Parsing..." : "Parse Resume"}
          </button>
        </div>
      </div>
    </div>
  );
}
