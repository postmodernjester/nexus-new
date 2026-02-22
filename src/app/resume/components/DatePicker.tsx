'use client'

import { useState, useEffect } from 'react'
import { MONTHS, YEARS } from '../types'
import { parseDate, buildDate } from '../utils'

export default function DatePicker({ label, value, onChange, disabled }: {
  label: string
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  const parsed = parseDate(value)
  const [month, setMonth] = useState(parsed.month)
  const [year, setYear] = useState(parsed.year)

  useEffect(() => {
    const p = parseDate(value)
    setMonth(p.month)
    setYear(p.year)
  }, [value])

  const handleChange = (newMonth: string, newYear: string) => {
    setMonth(newMonth)
    setYear(newYear)
    onChange(buildDate(newYear, newMonth))
  }

  const selectStyle: React.CSSProperties = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none',
  }

  return (
    <div>
      <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <select value={month} onChange={e => handleChange(e.target.value, year)} disabled={disabled} style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}>
          <option value="">Month (optional)</option>
          {MONTHS.slice(1).map((m, i) => (
            <option key={i + 1} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={e => handleChange(month, e.target.value)} disabled={disabled} style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}>
          <option value="">Year</option>
          {YEARS.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
