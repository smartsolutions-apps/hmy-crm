import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CollectionName, Database, Settings } from '@/types'
import { seedDatabase } from '@/data/seed'
import {
  emptyDatabase,
  firebaseEnabled,
  loadFromFirestore,
  readLocal,
  removeDoc,
  upsertDoc,
  writeAll,
  writeLocal,
} from '@/lib/repo'

const DEFAULT_SETTINGS: Settings = {
  companyName: 'HMY Perfumes',
  companyNameAr: 'HMY للعطور',
  currency: 'AED',
  vatRate: 0.05,
  trn: '100482913700003',
  address: 'Warehouse 7, Al Quoz Industrial 3, Dubai, UAE',
  phone: '+971 4 338 2200',
  email: 'hello@hmyperfumes.ae',
  lowStockAlerts: true,
}

interface DataValue {
  db: Database
  settings: Settings
  loading: boolean
  error: string | null
  source: 'firestore' | 'local'
  /** Insert or update a record and persist it. */
  save: <K extends CollectionName>(name: K, record: Database[K][number]) => Promise<void>
  remove: (name: CollectionName, id: string) => Promise<void>
  saveSettings: (s: Settings) => void
  /** Overwrite everything with the demo dataset. */
  loadSeed: (onProgress?: (m: string) => void) => Promise<void>
  refresh: () => Promise<void>
}

const DataContext = createContext<DataValue | null>(null)
const SETTINGS_KEY = 'hmy.settings'

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(emptyDatabase)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const source: 'firestore' | 'local' = firebaseEnabled ? 'firestore' : 'local'

  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (firebaseEnabled) {
        const remote = await loadFromFirestore()
        const isEmpty = Object.values(remote).every((arr) => (arr as unknown[]).length === 0)
        // A brand-new Firestore project shows the demo data until it is seeded,
        // so the app is never a blank screen.
        setDb(isEmpty ? seedDatabase : remote)
      } else {
        setDb(readLocal() ?? seedDatabase)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDb(readLocal() ?? seedDatabase)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const persistLocal = useCallback((next: Database) => {
    if (!firebaseEnabled) writeLocal(next)
  }, [])

  const save = useCallback(
    async <K extends CollectionName>(name: K, record: Database[K][number]) => {
      setDb((prev) => {
        const list = prev[name] as { id: string }[]
        const idx = list.findIndex((r) => r.id === (record as { id: string }).id)
        const nextList = idx >= 0
          ? [...list.slice(0, idx), record, ...list.slice(idx + 1)]
          : [record, ...list]
        const next = { ...prev, [name]: nextList } as Database
        persistLocal(next)
        return next
      })
      if (firebaseEnabled) {
        try {
          await upsertDoc(name, record as { id: string })
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    },
    [persistLocal]
  )

  const remove = useCallback(
    async (name: CollectionName, id: string) => {
      setDb((prev) => {
        const list = prev[name] as { id: string }[]
        const next = { ...prev, [name]: list.filter((r) => r.id !== id) } as Database
        persistLocal(next)
        return next
      })
      if (firebaseEnabled) {
        try {
          await removeDoc(name, id)
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    },
    [persistLocal]
  )

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  }, [])

  const loadSeed = useCallback(
    async (onProgress?: (m: string) => void) => {
      if (firebaseEnabled) {
        await writeAll(seedDatabase, onProgress)
        const remote = await loadFromFirestore()
        setDb(remote)
      } else {
        writeLocal(seedDatabase)
        setDb(seedDatabase)
        onProgress?.('local')
      }
    },
    []
  )

  const value = useMemo<DataValue>(
    () => ({ db, settings, loading, error, source, save, remove, saveSettings, loadSeed, refresh: bootstrap }),
    [db, settings, loading, error, source, save, remove, saveSettings, loadSeed, bootstrap]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
