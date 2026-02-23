"use client";

import React from "react";
import { s } from "../styles";
import { formatDate, renderContent } from "../utils";
import type { NoteEntry } from "../types";

const IMPORTANCE_CYCLE = [null, "green", "yellow", "red"] as const;
const IMPORTANCE_COLORS: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};

interface NotesSectionProps {
  notes: NoteEntry[];
  // Add note state
  noteText: string;
  setNoteText: (v: string) => void;
  noteDate: string;
  setNoteDate: (v: string) => void;
  noteContext: string;
  setNoteContext: (v: string) => void;
  noteAction: string;
  setNoteAction: (v: string) => void;
  noteActionDue: string;
  setNoteActionDue: (v: string) => void;
  addingNote: boolean;
  showActionFields: boolean;
  setShowActionFields: (v: boolean) => void;
  addNote: () => void;
  handleNoteKeyDown: (e: React.KeyboardEvent) => void;
  // Edit note state
  editingNoteId: string | null;
  setEditingNoteId: (v: string | null) => void;
  editNoteContent: string;
  setEditNoteContent: (v: string) => void;
  editNoteDate: string;
  setEditNoteDate: (v: string) => void;
  editNoteContext: string;
  setEditNoteContext: (v: string) => void;
  editNoteAction: string;
  setEditNoteAction: (v: string) => void;
  editNoteActionDue: string;
  setEditNoteActionDue: (v: string) => void;
  editNoteActionCompleted: boolean;
  setEditNoteActionCompleted: (v: boolean) => void;
  // Note action handlers
  updateNote: (id: string) => void;
  toggleAction: (note: NoteEntry) => void;
  deleteNote: (id: string) => void;
  toggleImportance: (note: NoteEntry) => void;
}

function ImportanceDot({ importance, onClick }: { importance: string | null; onClick: () => void }) {
  const color = importance ? IMPORTANCE_COLORS[importance] : "#334155";
  return (
    <button
      onClick={onClick}
      title={importance ? `Priority: ${importance}` : "Set priority"}
      style={{
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: color,
        border: importance ? `1px solid ${color}` : "1px solid #475569",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
        transition: "all 0.15s",
      }}
    />
  );
}

export default function NotesSection({
  notes,
  noteText,
  setNoteText,
  noteDate,
  setNoteDate,
  noteContext,
  setNoteContext,
  noteAction,
  setNoteAction,
  noteActionDue,
  setNoteActionDue,
  addingNote,
  showActionFields,
  setShowActionFields,
  addNote,
  handleNoteKeyDown,
  editingNoteId,
  setEditingNoteId,
  editNoteContent,
  setEditNoteContent,
  editNoteDate,
  setEditNoteDate,
  editNoteContext,
  setEditNoteContext,
  editNoteAction,
  setEditNoteAction,
  editNoteActionDue,
  setEditNoteActionDue,
  editNoteActionCompleted,
  setEditNoteActionCompleted,
  updateNote,
  toggleAction,
  deleteNote,
  toggleImportance,
}: NotesSectionProps) {
  return (
    <div style={s.card}>
      <div style={s.sectionLabel}>Notes & Research</div>

      {/* Add note form */}
      <div
        style={{
          marginBottom: "16px",
          background: "#0f172a",
          borderRadius: "8px",
          border: "1px solid #334155",
          overflow: "hidden",
        }}
      >
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleNoteKeyDown}
          placeholder="Add a note, paste a URL, meeting notes, research..."
          rows={2}
          style={{
            ...s.textarea,
            border: "none",
            borderRadius: "8px 8px 0 0",
            background: "transparent",
            fontSize: "13px",
            padding: "10px 12px",
          }}
        />

        {/* Date + Context row */}
        <div
          style={{
            padding: "6px 12px",
            borderTop: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <input
            type="date"
            value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)}
            style={{
              ...s.input,
              width: "130px",
              fontSize: "11px",
              padding: "4px 6px",
              background: "transparent",
              border: "1px solid #1e293b",
              color: "#64748b",
            }}
          />
          <input
            value={noteContext}
            onChange={(e) => setNoteContext(e.target.value)}
            placeholder="context (meeting, call, research...)"
            style={{
              ...s.input,
              flex: 1,
              fontSize: "11px",
              padding: "4px 8px",
              background: "transparent",
              border: "1px solid #1e293b",
              color: "#94a3b8",
            }}
          />
        </div>

        {/* Action row */}
        <div
          style={{
            padding: "6px 12px 8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            onClick={() => setShowActionFields(!showActionFields)}
            style={{
              background: "none",
              border: "none",
              fontSize: "11px",
              padding: "3px 0",
              color: showActionFields ? "#a78bfa" : "#475569",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontWeight: showActionFields ? 600 : 400,
            }}
          >
            + Next Steps
          </button>

          {showActionFields && (
            <>
              <input
                value={noteAction}
                onChange={(e) => setNoteAction(e.target.value)}
                placeholder="Follow up, send proposal..."
                style={{
                  ...s.input,
                  flex: 1,
                  fontSize: "11px",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "1px solid #1e293b",
                  color: "#e2e8f0",
                }}
              />
              <span style={{ fontSize: "10px", color: "#475569" }}>due</span>
              <input
                type="date"
                value={noteActionDue}
                onChange={(e) => setNoteActionDue(e.target.value)}
                style={{
                  ...s.input,
                  width: "130px",
                  fontSize: "11px",
                  padding: "4px 6px",
                  background: "transparent",
                  border: "1px solid #1e293b",
                  color: "#64748b",
                }}
              />
            </>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "9px", color: "#334155" }}>
              Cmd+Enter
            </span>
            <button
              onClick={addNote}
              disabled={addingNote || !noteText.trim()}
              style={{
                ...s.btnPrimary,
                fontSize: "11px",
                padding: "4px 14px",
                opacity: addingNote || !noteText.trim() ? 0.3 : 1,
              }}
            >
              {addingNote ? "..." : "Add"}
            </button>
          </div>
        </div>
      </div>

      {/* Notes list — dossier style */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {notes.map((note) => (
          <div key={note.id}>
            {editingNoteId === note.id ? (
              /* Edit mode */
              <div
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #1e293b",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <textarea
                  value={editNoteContent}
                  onChange={(e) => setEditNoteContent(e.target.value)}
                  rows={2}
                  style={{ ...s.textarea, fontSize: "13px" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <input
                    type="date"
                    value={editNoteDate}
                    onChange={(e) => setEditNoteDate(e.target.value)}
                    style={{ ...s.input, width: "130px", fontSize: "11px", padding: "4px 6px" }}
                  />
                  <input
                    value={editNoteContext}
                    onChange={(e) => setEditNoteContext(e.target.value)}
                    placeholder="context"
                    style={{ ...s.input, width: "140px", fontSize: "11px", padding: "4px 6px" }}
                  />
                  <input
                    value={editNoteAction}
                    onChange={(e) => setEditNoteAction(e.target.value)}
                    placeholder="next step"
                    style={{ ...s.input, flex: 1, fontSize: "11px", padding: "4px 6px" }}
                  />
                  <input
                    type="date"
                    value={editNoteActionDue}
                    onChange={(e) => setEditNoteActionDue(e.target.value)}
                    style={{ ...s.input, width: "130px", fontSize: "11px", padding: "4px 6px" }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#64748b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editNoteActionCompleted}
                      onChange={(e) => setEditNoteActionCompleted(e.target.checked)}
                      style={{ accentColor: "#a78bfa" }}
                    />
                    Done
                  </label>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => updateNote(note.id)}
                    style={{ ...s.btnPrimary, fontSize: "11px", padding: "4px 12px" }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingNoteId(null)}
                    style={{ ...s.btnSecondary, fontSize: "11px", padding: "4px 10px" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Read mode — compact dossier row */
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "7px 0",
                  borderBottom: "1px solid rgba(30,41,59,0.6)",
                }}
              >
                {/* Priority dot */}
                <div style={{ paddingTop: "4px" }}>
                  <ImportanceDot
                    importance={note.importance}
                    onClick={() => toggleImportance(note)}
                  />
                </div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Date + note + context row */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {formatDate(note.entry_date)}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#cbd5e1",
                        lineHeight: "1.5",
                        whiteSpace: "pre-wrap",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {renderContent(note.content)}
                    </span>
                    {note.context && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#64748b",
                          padding: "1px 6px",
                          background: "#1e293b",
                          borderRadius: "3px",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {note.context}
                      </span>
                    )}
                    {/* Edit/delete — subtle on hover */}
                    <div
                      style={{ display: "flex", gap: "6px", opacity: 0, flexShrink: 0 }}
                      className="note-actions"
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                    >
                      <button
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditNoteContent(note.content);
                          setEditNoteDate(note.entry_date);
                          setEditNoteContext(note.context || "");
                          setEditNoteAction(note.action_text || "");
                          setEditNoteActionDue(note.action_due_date || "");
                          setEditNoteActionCompleted(note.action_completed);
                        }}
                        style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "10px", padding: "0 2px" }}
                      >
                        edit
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "10px", padding: "0 2px" }}
                      >
                        del
                      </button>
                    </div>
                  </div>

                  {/* Action item — inline below */}
                  {note.action_text && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "3px",
                        paddingLeft: "2px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={note.action_completed}
                        onChange={() => toggleAction(note)}
                        style={{
                          cursor: "pointer",
                          accentColor: "#a78bfa",
                          width: "12px",
                          height: "12px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          color: note.action_completed ? "#475569" : "#94a3b8",
                          textDecoration: note.action_completed ? "line-through" : "none",
                        }}
                      >
                        {note.action_text}
                      </span>
                      {note.action_due_date && (
                        <span
                          style={{
                            fontSize: "10px",
                            color:
                              !note.action_completed && new Date(note.action_due_date) < new Date()
                                ? "#f87171"
                                : "#475569",
                          }}
                        >
                          due {formatDate(note.action_due_date)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <div
            style={{
              padding: "20px 0",
              textAlign: "center",
              color: "#475569",
              fontSize: "12px",
              lineHeight: "1.6",
            }}
          >
            No notes yet. Paste LinkedIn profiles, articles, meeting notes — anything.
          </div>
        )}
      </div>

      {/* Hover CSS for note actions */}
      <style>{`
        .note-actions { transition: opacity 0.15s; }
        div:hover > div > .note-actions,
        div:hover > .note-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
