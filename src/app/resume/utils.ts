import { MONTHS } from './types'

export function parseDate(dateStr: string): { month: string; year: string } {
  if (!dateStr) return { month: '', year: '' }
  const parts = dateStr.split('-')
  return { year: parts[0] || '', month: parts[1] ? String(parseInt(parts[1])) : '' }
}

export function buildDate(year: string, month: string): string {
  if (!year) return ''
  if (!month) return `${year}-01-01`
  return `${year}-${month.padStart(2, '0')}-01`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const { month, year } = parseDate(dateStr)
  if (!year) return ''
  if (!month || month === '0') return year
  return `${MONTHS[parseInt(month)]} ${year}`
}
