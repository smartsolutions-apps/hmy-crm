import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Search, X, ArrowUpDown, Inbox } from 'lucide-react'
import { useI18n } from '@/i18n'

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 no-print">{actions}</div>}
    </div>
  )
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-ink-100">
          <div>
            {title && <h2 className="section-title">{title}</h2>}
            {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={clsx('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'good' | 'bad' | 'warn'
  icon?: ReactNode
}) {
  const toneClass = {
    default: 'text-ink-900',
    good: 'text-emerald-600',
    bad: 'text-rose-600',
    warn: 'text-amber-600',
  }[tone]
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        {icon && <span className="text-ink-300">{icon}</span>}
      </div>
      <p className={clsx('mt-2 text-xl sm:text-2xl font-semibold tnum', toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

export function EmptyState({ message, hint }: { message?: string; hint?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="h-8 w-8 text-ink-300" />
      <p className="mt-3 text-sm font-medium text-ink-600">{message ?? t('common.noResults')}</p>
      <p className="mt-1 text-xs text-ink-400 max-w-xs">{hint ?? t('common.noResultsHint')}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeTone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gold'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-rose-50 text-rose-700',
  blue: 'bg-sky-50 text-sky-700',
  purple: 'bg-violet-50 text-violet-700',
  gold: 'bg-gold-100 text-gold-800',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={clsx('chip', badgeTones[tone])}>{children}</span>
}

export const statusTone = (status: string): BadgeTone => {
  switch (status) {
    case 'delivered': case 'completed': case 'paid': case 'received': case 'active': case 'won':
      return 'green'
    case 'shipped': case 'packed': case 'confirmed': case 'running': case 'in_progress': case 'qualified':
      return 'blue'
    case 'macerating': case 'partial': case 'planned': case 'ordered': case 'contacted': case 'draft': case 'paused':
      return 'amber'
    case 'cancelled': case 'returned': case 'unpaid': case 'refunded': case 'lost': case 'discontinued':
      return 'red'
    case 'new':
      return 'purple'
    default:
      return 'neutral'
  }
}

// ---------------------------------------------------------------------------
// Search + filter bar
// ---------------------------------------------------------------------------

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const { t } = useI18n()
  return (
    <div className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
      <input
        className="input ps-9 pe-8"
        value={value}
        placeholder={placeholder ?? t('common.search')}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="absolute end-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
          onClick={() => onChange('')}
          aria-label="clear"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  className?: string
}) {
  return (
    <select className={clsx('input', className)} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Sortable table
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Return a comparable primitive to enable sorting on this column. */
  sortValue?: (row: T) => string | number
  align?: 'start' | 'end' | 'center'
  className?: string
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  initialSort,
  emptyMessage,
  footer,
}: {
  rows: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  emptyMessage?: string
  footer?: ReactNode
}) {
  const [sort, setSort] = useState(initialSort ?? null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [rows, columns, sort])

  const toggleSort = (key: string) => {
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    )
  }

  if (!rows.length) return <EmptyState message={emptyMessage} />

  const alignClass = (a?: Column<T>['align']) =>
    a === 'end' ? 'text-end' : a === 'center' ? 'text-center' : 'text-start'

  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-5">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={clsx('th', alignClass(c.align), c.className)}>
                {c.sortValue ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-ink-800"
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.header}
                    <ArrowUpDown className={clsx('h-3 w-3', sort?.key === c.key ? 'text-gold-600' : 'text-ink-300')} />
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className={clsx('hover:bg-gold-50/40 transition-colors', onRowClick && 'cursor-pointer')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx('td', alignClass(c.align), c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot className="bg-ink-50/70 font-medium">{footer}</tfoot>}
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal / drawer
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="fixed inset-0 bg-ink-950/40" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full bg-white rounded-xl shadow-xl my-4',
          wide ? 'max-w-4xl' : 'max-w-lg'
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button className="text-ink-400 hover:text-ink-700" onClick={onClose} aria-label="close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ink-100">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

/** A tiny horizontal bar used inside table cells to show proportion. */
export function MiniBar({ value, max, tone = 'gold' }: { value: number; max: number; tone?: 'gold' | 'rose' | 'emerald' }) {
  const w = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const bg = tone === 'rose' ? 'bg-rose-400' : tone === 'emerald' ? 'bg-emerald-400' : 'bg-gold-400'
  return (
    <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
      <div className={clsx('h-full rounded-full', bg)} style={{ width: `${w}%` }} />
    </div>
  )
}

export function exportCsv(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
