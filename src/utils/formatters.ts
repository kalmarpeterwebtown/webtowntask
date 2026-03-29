import { format, formatDistanceToNow } from 'date-fns'
import { hu } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'

export function formatDate(ts: Timestamp | Date | string | undefined): string {
  if (!ts) return ''
  const date = ts instanceof Date ? ts : 'toDate' in (ts as Timestamp) ? (ts as Timestamp).toDate() : new Date(ts as string)
  return format(date, 'yyyy. MM. dd.', { locale: hu })
}

export function formatDateTime(ts: Timestamp | Date | undefined): string {
  if (!ts) return ''
  const date = ts instanceof Date ? ts : (ts as Timestamp).toDate()
  return format(date, 'yyyy. MM. dd. HH:mm', { locale: hu })
}

export function timeAgo(ts: Timestamp | Date | undefined): string {
  if (!ts) return ''
  const date = ts instanceof Date ? ts : (ts as Timestamp).toDate()
  return formatDistanceToNow(date, { addSuffix: true, locale: hu })
}

/** "90" → "1h 30m" */
export function minutesToDisplay(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/** "1.5h", "1:30h", "90p", "30m", "1d" → percek */
export function parseWorklogInput(input: string, hoursPerDay = 8): number {
  const s = input.trim().toLowerCase()
  const colonHoursMatch = s.match(/^(\d+):(\d{1,2})h?$/)
  if (colonHoursMatch) {
    const hours = Number(colonHoursMatch[1] ?? 0)
    const minutes = Number(colonHoursMatch[2] ?? 0)
    return (hours * 60) + minutes
  }

  if (s.endsWith('d')) return Math.round(parseFloat(s) * hoursPerDay * 60)
  if (s.endsWith('h')) return Math.round(parseFloat(s) * 60)
  if (s.endsWith('m') || s.endsWith('p')) return Math.round(parseFloat(s))
  // Ha nincs suffix, percnek tekintjük
  return Math.round(parseFloat(s)) || 0
}

/** Projekt prefix + szám → pl. "WEB-42" */
export function storyId(prefix: string, seq: number): string {
  return `${prefix}-${seq}`
}
