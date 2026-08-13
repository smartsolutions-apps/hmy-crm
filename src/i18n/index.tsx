import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { dictionary, type Lang, type TranslationKey } from './dictionary'
import * as fmt from '@/lib/format'

interface I18nValue {
  lang: Lang
  dir: 'ltr' | 'rtl'
  setLang: (l: Lang) => void
  toggle: () => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  /** Picks the Arabic field when the UI is Arabic, falling back to English. */
  pick: (en: string, ar?: string) => string
  money: (n: number, decimals?: number) => string
  moneyShort: (n: number) => string
  num: (n: number, decimals?: number) => string
  percent: (n: number, decimals?: number) => string
  date: (iso: string | null | undefined) => string
  qty: (n: number, unit: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

const STORAGE_KEY = 'hmy.lang'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'ar' || saved === 'en' ? saved : 'en'
  })

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    document.body.classList.toggle('lang-ar', lang === 'ar')
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang, dir])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const toggle = useCallback(() => setLangState((l) => (l === 'en' ? 'ar' : 'en')), [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const table = dictionary[lang] as Record<string, string>
      let s = table[key] ?? (dictionary.en as Record<string, string>)[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
      }
      return s
    },
    [lang]
  )

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir,
      setLang,
      toggle,
      t,
      pick: (en, ar) => (lang === 'ar' && ar ? ar : en),
      money: (n, decimals = 2) => fmt.money(n, lang, decimals),
      moneyShort: (n) => fmt.moneyShort(n, lang),
      num: (n, decimals = 0) => fmt.num(n, lang, decimals),
      percent: (n, decimals = 1) => fmt.percent(n, lang, decimals),
      date: (iso) => fmt.date(iso, lang),
      qty: (n, unit) => fmt.qty(n, unit, lang),
    }),
    [lang, dir, setLang, toggle, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

export type { Lang, TranslationKey }
