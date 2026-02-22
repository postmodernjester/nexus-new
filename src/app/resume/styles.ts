import React from 'react'

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '14px',
  outline: 'none',
}

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '80px',
  resize: 'vertical' as const,
  fontFamily: 'inherit',
}

export const btnPrimary: React.CSSProperties = {
  padding: '8px 18px',
  background: '#a78bfa',
  color: '#0f172a',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
}

export const btnSecondary: React.CSSProperties = {
  padding: '8px 18px',
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid #334155',
  borderRadius: '6px',
  fontWeight: 500,
  fontSize: '13px',
  cursor: 'pointer',
}

export const btnDanger: React.CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  color: '#ef4444',
  border: '1px solid #7f1d1d',
  borderRadius: '6px',
  fontWeight: 500,
  fontSize: '12px',
  cursor: 'pointer',
}

export const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: '6px',
  background: 'transparent', border: '1px solid #334155',
  color: '#94a3b8', cursor: 'pointer',
}

export const iconBtnDanger: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: '6px',
  background: 'transparent', border: '1px solid #7f1d1d',
  color: '#ef4444', cursor: 'pointer',
}

export const cardStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '12px',
  padding: '24px',
}

export const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
}

export const modalBox: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '16px',
  padding: '32px',
  width: '100%',
  maxWidth: '560px',
  maxHeight: '80vh',
  overflowY: 'auto',
}
