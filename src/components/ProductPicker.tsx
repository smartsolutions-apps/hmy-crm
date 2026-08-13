import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChevronUp, Search, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { Product } from '@/types'

/**
 * Type-ahead multi-select for perfumes. Order matters — the first chip is the
 * hero product the website leads with, so chips can be promoted.
 */
export default function ProductPicker({
  products,
  value,
  onChange,
  placeholder,
}: {
  products: Product[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}) {
  const { t, lang, money } = useI18n()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<number | null>(null)

  const name = (p: Product) => (lang === 'ar' ? p.nameAr : p.nameEn)

  const selected = useMemo(
    () => value.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [value, products]
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => !value.includes(p.id))
      .filter((p) => {
        if (!q) return true
        return (
          p.nameEn.toLowerCase().includes(q) ||
          p.nameAr.includes(query.trim()) ||
          p.sku.toLowerCase().includes(q) ||
          p.family.toLowerCase().includes(q) ||
          p.concentration.toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [products, value, query])

  const add = (id: string) => {
    onChange([...value, id])
    setQuery('')
  }

  const remove = (id: string) => onChange(value.filter((x) => x !== id))

  const promote = (id: string) => {
    const idx = value.indexOf(id)
    if (idx <= 0) return
    const next = [...value]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  return (
    <div>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((p, i) => (
            <li
              key={p.id}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg ps-2 pe-1 py-1 text-xs border',
                i === 0
                  ? 'bg-gold-50 border-gold-300 text-gold-900'
                  : 'bg-white border-ink-200 text-ink-700'
              )}
            >
              {i === 0 && <span className="font-semibold uppercase text-[9px]">{t('ev.hero')}</span>}
              <span className="font-medium">{name(p)}</span>
              <span className="text-ink-400 tnum">{p.sizeMl}ml</span>
              {i > 0 && (
                <button
                  type="button"
                  className="text-ink-400 hover:text-gold-700"
                  onClick={() => promote(p.id)}
                  title={t('ev.hero')}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                className="text-ink-400 hover:text-rose-600"
                onClick={() => remove(p.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
        <input
          className="input ps-9"
          value={query}
          placeholder={placeholder ?? t('ev.pickProducts')}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on an option still registers.
            blurTimer.current = window.setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches.length) {
              e.preventDefault()
              add(matches[0].id)
            }
            if (e.key === 'Escape') setOpen(false)
          }}
        />

        {open && matches.length > 0 && (
          <ul
            className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg"
            onMouseDown={() => {
              if (blurTimer.current) window.clearTimeout(blurTimer.current)
            }}
          >
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-start hover:bg-gold-50"
                  onClick={() => add(p.id)}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-ink-900 truncate">{name(p)}</span>
                    <span className="block text-[11px] text-ink-400 tnum">
                      {p.sku} · {p.concentration} {p.sizeMl}ml
                    </span>
                  </span>
                  <span className="text-xs tnum text-ink-600 shrink-0">{money(p.price, 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected.length > 0 && (
        <p className="mt-1.5 text-xs text-ink-400">{t('ev.addedProducts', { n: selected.length })}</p>
      )}
    </div>
  )
}
