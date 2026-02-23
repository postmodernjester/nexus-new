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

export function computeDuration(startDate: string, endDate: string, isCurrent: boolean): string {
  if (!startDate) return ''
  const start = new Date(startDate)
  const end = isCurrent ? new Date() : (endDate ? new Date(endDate) : new Date())

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (months < 1) return '< 1 mo'

  const years = Math.floor(months / 12)
  const rem = months % 12

  if (years === 0) return `${rem} mo${rem !== 1 ? 's' : ''}`
  if (rem === 0) return `${years} yr${years !== 1 ? 's' : ''}`
  return `${years} yr${years !== 1 ? 's' : ''} ${rem} mo${rem !== 1 ? 's' : ''}`
}
