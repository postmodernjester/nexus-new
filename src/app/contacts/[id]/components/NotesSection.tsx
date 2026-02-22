"use client";

import React from "react";
import { s } from "../styles";
import { formatDate, renderContent } from "../utils";
import type { NoteEntry } from "../types";

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
  // Add note handler
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
}: NotesSectionProps) {
  return (
    <div style={s.card}>
      <div style={s.sectionLabel}>Notes & Research</div>

      {/* Add note */}
      <div
        style={{
          marginBottom: "20px",
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
          placeholder="Add a note, paste a URL, meeting notes, research…"
          rows={3}
          style={{
            ...s.textarea,
            border: "none",
            borderRadius: "8px 8px 0 0",
            background: "transparent",
          }}
        />
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid #1e293b",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="date"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
              style={{
                ...s.input,
                width: "140px",
                fontSize: "12px",
                padding: "4px 8px",
                background: "transparent",
                border: "1px solid #1e293b",
              }}
            />
            <input
              value={noteContext}
              onChange={(e) => setNoteContext(e.target.value)}
              placeholder="context (meeting, call, research…)"
              style={{
                ...s.input,
                width: "200px",
                fontSize: "12px",
                padding: "4px 8px",
                background: "transparent",
                border: "1px solid #1e293b",
              }}
            />
            <button
              onClick={() => setShowActionFields(!showActionFields)}
              style={{
                ...s.btnSecondary,
                fontSize: "11px",
                padding: "3px 10px",
                color: showActionFields ? "#a78bfa" : "#64748b",
                borderColor: showActionFields ? "#a78bfa" : "#334155",
              }}
            >
              + Action
            </button>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "10px", color: "#475569" }}>
                Cmd+Enter
              </span>
              <button
                onClick={addNote}
                disabled={addingNote || !noteText.trim()}
                style={{
                  ...s.btnPrimary,
                  fontSize: "12px",
                  padding: "5px 14px",
                  opacity: addingNote || !noteText.trim() ? 0.4 : 1,
                }}
              >
                {addingNote ? "…" : "Add"}
              </button>
            </div>
          </div>

          {showActionFields && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 0",
              }}
            >
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Action:
              </span>
              <input
                value={noteAction}
                onChange={(e) => setNoteAction(e.target.value)}
                placeholder="Follow up, send proposal, schedule call…"
                style={{
                  ...s.input,
                  flex: 1,
                  fontSize: "12px",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "1px solid #1e293b",
                }}
              />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Due:
              </span>
              <input
                type="date"
                value={noteActionDue}
                onChange={(e) => setNoteActionDue(e.target.value)}
                style={{
                  ...s.input,
                  width: "140px",
                  fontSize: "12px",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "1px solid #1e293b",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Notes list */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {notes.map((note) => (
          <div
            key={note.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid #1e293b",
            }}
          >
            {editingNoteId === note.id ? (
              /* Edit mode */
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <textarea
                  value={editNoteContent}
                  onChange={(e) => setEditNoteContent(e.target.value)}
                  rows={3}
                  style={s.textarea}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="date"
                    value={editNoteDate}
                    onChange={(e) => setEditNoteDate(e.target.value)}
                    style={{
                      ...s.input,
                      width: "140px",
                      fontSize: "12px",
                      padding: "4px 8px",
                    }}
                  />
                  <input
                    value={editNoteContext}
                    onChange={(e) => setEditNoteContext(e.target.value)}
                    placeholder="context"
                    style={{
                      ...s.input,
                      width: "160px",
                      fontSize: "12px",
                      padding: "4px 8px",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Action:
                  </span>
                  <input
                    value={editNoteAction}
                    onChange={(e) => setEditNoteAction(e.target.value)}
                    placeholder="action item"
                    style={{
                      ...s.input,
                      flex: 1,
                      fontSize: "12px",
                      padding: "4px 8px",
                    }}
                  />
                  <input
                    type="date"
                    value={editNoteActionDue}
                    onChange={(e) => setEditNoteActionDue(e.target.value)}
                    style={{
                      ...s.input,
                      width: "140px",
                      fontSize: "12px",
                      padding: "4px 8px",
                    }}
                  />
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      color: "#64748b",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editNoteActionCompleted}
                      onChange={(e) =>
                        setEditNoteActionCompleted(e.target.checked)
                      }
                      style={{ accentColor: "#a78bfa" }}
                    />
                    Done
                  </label>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "4px",
                  }}
                >
                  <button
                    onClick={() => updateNote(note.id)}
                    style={{
                      ...s.btnPrimary,
                      fontSize: "11px",
                      padding: "5px 14px",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingNoteId(null)}
                    style={{
                      ...s.btnSecondary,
                      fontSize: "11px",
                      padding: "5px 12px",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Read mode */
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "#e2e8f0",
                    whiteSpace: "pre-wrap",
                    marginBottom: "6px",
                  }}
                >
                  {renderContent(note.content)}
                </div>

                {/* Action item */}
                {note.action_text && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      margin: "8px 0",
                      padding: "8px 12px",
                      background: note.action_completed
                        ? "rgba(16,185,129,0.08)"
                        : "rgba(251,191,36,0.08)",
                      borderRadius: "6px",
                      border: `1px solid ${note.action_completed ? "rgba(16,185,129,0.2)" : "rgba(251,191,36,0.2)"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={note.action_completed}
                      onChange={() => toggleAction(note)}
                      style={{
                        marginTop: "2px",
                        cursor: "pointer",
                        accentColor: "#a78bfa",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <span
                        style={{
                          fontSize: "13px",
                          textDecoration: note.action_completed
                            ? "line-through"
                            : "none",
                          color: note.action_completed
                            ? "#64748b"
                            : "#e2e8f0",
                        }}
                      >
                        {note.action_text}
                      </span>
                      {note.action_due_date && (
                        <span
                          style={{
                            fontSize: "11px",
                            marginLeft: "10px",
                            color:
                              !note.action_completed &&
                              new Date(note.action_due_date) < new Date()
                                ? "#f87171"
                                : "#64748b",
                          }}
                        >
                          due {formatDate(note.action_due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Meta row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "11px",
                      color: "#475569",
                    }}
                  >
                    <span>{formatDate(note.entry_date)}</span>
                    {note.context && (
                      <span
                        style={{
                          padding: "1px 6px",
                          background: "#334155",
                          borderRadius: "4px",
                          fontSize: "10px",
                        }}
                      >
                        {note.context}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      opacity: 0.3,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "1")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "0.3")
                    }
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
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      edit
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <div
            style={{
              padding: "24px 0",
              textAlign: "center",
              color: "#475569",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
          >
            No notes yet. Paste LinkedIn profiles, Wikipedia pages, articles,
            meeting notes — anything.
            <br />
            The AI summary reads linked pages and synthesizes a profile.
          </div>
        )}
      </div>
    </div>
  );
}
