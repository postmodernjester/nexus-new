"use client";

import React from "react";
import { s } from "../styles";
import { REL_TYPES } from "../utils";
import type { Contact } from "../types";

interface EditContactFormProps {
  editFields: Partial<Contact>;
  setField: (k: string, v: string | boolean) => void;
  saving: boolean;
  saveContact: () => void;
  onCancel: () => void;
}

export default function EditContactForm({
  editFields,
  setField,
  saving,
  saveContact,
  onCancel,
}: EditContactFormProps) {
  return (
    <div style={s.card}>
      <div style={s.sectionLabel}>Edit Contact</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={s.label}>Full Name</label>
          <input
            style={s.input}
            value={editFields.full_name || ""}
            onChange={(e) => setField("full_name", e.target.value)}
          />
        </div>
        <div>
          <label style={s.label}>Role / Title</label>
          <input
            style={s.input}
            value={editFields.role || ""}
            onChange={(e) => setField("role", e.target.value)}
          />
        </div>
        <div>
          <label style={s.label}>Company</label>
          <input
            style={s.input}
            value={editFields.company || ""}
            onChange={(e) => setField("company", e.target.value)}
          />
        </div>
        <div>
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            value={editFields.email || ""}
            onChange={(e) => setField("email", e.target.value)}
          />
        </div>
        <div>
          <label style={s.label}>Phone</label>
          <input
            style={s.input}
            value={editFields.phone || ""}
            onChange={(e) => setField("phone", e.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={s.label}>Location</label>
          <input
            style={s.input}
            value={editFields.location || ""}
            onChange={(e) => setField("location", e.target.value)}
          />
        </div>
        <div>
          <label style={s.label}>Relationship</label>
          <select
            style={s.select}
            value={editFields.relationship_type || "Acquaintance"}
            onChange={(e) =>
              setField("relationship_type", e.target.value)
            }
          >
            {REL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={s.label}>Last Contact</label>
          <input
            style={s.input}
            type="date"
            value={editFields.last_contact_date || ""}
            onChange={(e) =>
              setField("last_contact_date", e.target.value)
            }
          />
        </div>
        <div
          style={{
            gridColumn: "1 / -1",
            borderTop: "1px solid #334155",
            paddingTop: "12px",
            marginTop: "4px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={editFields.show_on_chronicle || false}
              onChange={(e) =>
                setField("show_on_chronicle", e.target.checked)
              }
              style={{
                width: "14px",
                height: "14px",
                accentColor: "#a78bfa",
              }}
            />
            <span style={{ fontSize: "13px", color: "#e2e8f0" }}>
              Show on Chronicle
            </span>
          </label>
        </div>
        {editFields.show_on_chronicle && (
          <div>
            <label style={s.label}>Chronicle Start Date</label>
            <input
              style={s.input}
              type="date"
              value={editFields.met_date || ""}
              onChange={(e) => setField("met_date", e.target.value)}
              placeholder="When they entered the story"
            />
            <div
              style={{
                fontSize: "10px",
                color: "#64748b",
                marginTop: "4px",
              }}
            >
              When this person entered your story (defaults to card creation
              date)
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          marginTop: "16px",
        }}
      >
        <button
          onClick={onCancel}
          style={s.btnSecondary}
        >
          Cancel
        </button>
        <button
          onClick={saveContact}
          disabled={saving}
          style={{ ...s.btnPrimary, opacity: saving ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
