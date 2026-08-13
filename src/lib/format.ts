export function money(n: number, lang: 'en' | 'ar' = 'en', decimals = 2) {
  if (!isFinite(n)) n = 0
  const v = new Intl.NumberFormat(lang === 'ar' ? 'ar-AE' : 'en-AE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
  return lang === 'ar' ? `${v} د.إ` : `AED ${v}`
}

/** Compact form for KPI tiles: AED 12.4k */
export function moneyShort(n: number, lang: 'en' | 'ar' = 'en') {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${money(n / 1_000_000, lang, 1)}M`.replace('.0M', 'M')
  if (abs >= 10_000) return `${money(n / 1000, lang, 1)}k`.replace('.0k', 'k')
  return money(n, lang, 0)
}

export function num(n: number, lang: 'en' | 'ar' = 'en', decimals = 0) {
  if (!isFinite(n)) n = 0
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-AE' : 'en-AE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function percent(n: number, lang: 'en' | 'ar' = 'en', decimals = 1) {
  if (!isFinite(n)) n = 0
  return `${num(n, lang, decimals)}%`
}

export function date(iso: string | null | undefined, lang: 'en' | 'ar' = 'en') {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function qty(n: number, unit: string, lang: 'en' | 'ar' = 'en') {
  const decimals = unit === 'pcs' ? 0 : n % 1 === 0 ? 0 : 2
  return `${num(n, lang, decimals)} ${unit}`
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
