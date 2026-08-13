import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { firestore, firebaseEnabled } from './firebase'
import type { CollectionName, Database } from '@/types'

export const COLLECTIONS: CollectionName[] = [
  'materials',
  'products',
  'formulas',
  'batches',
  'customers',
  'interactions',
  'orders',
  'suppliers',
  'purchases',
  'campaigns',
  'leads',
  'expenses',
  'giftEvents',
  'giftRecommendations',
]

export const emptyDatabase = (): Database => ({
  materials: [],
  products: [],
  formulas: [],
  batches: [],
  customers: [],
  interactions: [],
  orders: [],
  suppliers: [],
  purchases: [],
  campaigns: [],
  leads: [],
  expenses: [],
  giftEvents: [],
  giftRecommendations: [],
})

const LOCAL_KEY = 'hmy.db'

// ---------------------------------------------------------------------------
// Local (no-Firebase) persistence — keeps the app fully usable before deploy
// ---------------------------------------------------------------------------

export function readLocal(): Database | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Database>
    return { ...emptyDatabase(), ...parsed }
  } catch {
    return null
  }
}

export function writeLocal(db: Database) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(db))
  } catch {
    /* quota exceeded — nothing we can do, the in-memory copy still works */
  }
}

export function clearLocal() {
  localStorage.removeItem(LOCAL_KEY)
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

export async function loadFromFirestore(): Promise<Database> {
  if (!firestore) throw new Error('Firestore is not configured')
  const db = emptyDatabase()
  await Promise.all(
    COLLECTIONS.map(async (name) => {
      const snap = await getDocs(collection(firestore!, name))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(db[name] as any[]) = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    })
  )
  return db
}

export async function upsertDoc(name: CollectionName, record: { id: string }) {
  if (!firestore) return
  const { id, ...rest } = record
  await setDoc(doc(firestore, name, id), rest, { merge: true })
}

export async function removeDoc(name: CollectionName, id: string) {
  if (!firestore) return
  await deleteDoc(doc(firestore, name, id))
}

/** Writes the whole dataset. Firestore caps a batch at 500 writes, so we chunk. */
export async function writeAll(data: Database, onProgress?: (msg: string) => void) {
  if (!firestore) throw new Error('Firestore is not configured')

  for (const name of COLLECTIONS) {
    const rows = data[name] as { id: string }[]
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400)
      const batch = writeBatch(firestore)
      for (const row of chunk) {
        const { id, ...rest } = row
        batch.set(doc(firestore, name, id), rest)
      }
      await batch.commit()
    }
    onProgress?.(`${name}: ${rows.length}`)
  }
}

export async function wipeAll(onProgress?: (msg: string) => void) {
  if (!firestore) throw new Error('Firestore is not configured')
  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(firestore, name))
    for (let i = 0; i < snap.docs.length; i += 400) {
      const chunk = snap.docs.slice(i, i + 400)
      const batch = writeBatch(firestore)
      for (const d of chunk) batch.delete(d.ref)
      await batch.commit()
    }
    onProgress?.(`cleared ${name}`)
  }
}

export { firebaseEnabled }
