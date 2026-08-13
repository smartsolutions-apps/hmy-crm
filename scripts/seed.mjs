#!/usr/bin/env node
/**
 * Writes the demo dataset into Firestore.
 *
 *   npm run seed            # write everything
 *   npm run seed -- --wipe  # delete the existing docs first
 *
 * Reads Firebase config from .env (the same VITE_* variables the app uses).
 * If you would rather not use the terminal, the app has a "Load demo data"
 * button under Settings that does exactly the same thing.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, getDocs, writeBatch } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// --- .env ------------------------------------------------------------------
function loadEnv() {
  const out = {}
  try {
    const raw = readFileSync(path.join(root, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env — fall through to process.env */
  }
  return { ...out, ...process.env }
}

const env = loadEnv()
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

if (!cfg.apiKey || !cfg.projectId) {
  console.error(
    '\n  No Firebase config found.\n\n' +
      '  Copy .env.example to .env and paste the values from\n' +
      '  Firebase console → Project settings → Your apps → Web app.\n\n' +
      '  Or just open the app, go to Settings, and press "Load demo data".\n'
  )
  process.exit(1)
}

// --- compile the TypeScript seed module so Node can import it ---------------
const tmpDir = path.join(root, 'node_modules', '.seed-tmp')
mkdirSync(tmpDir, { recursive: true })
const bundlePath = path.join(tmpDir, 'seed.mjs')

await build({
  entryPoints: [path.join(root, 'src/data/seed.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: bundlePath,
  logLevel: 'silent',
})

const seed = await import(`file://${bundlePath}`)
const data = seed.seedDatabase

const COLLECTIONS = [
  'materials', 'products', 'formulas', 'batches',
  'customers', 'interactions', 'orders', 'suppliers',
  'purchases', 'campaigns', 'leads', 'expenses',
]

const app = initializeApp(cfg)
const db = getFirestore(app)

/** Firestore rejects `undefined`; strip those keys before writing. */
const clean = (obj) => {
  if (Array.isArray(obj)) return obj.map(clean)
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue
      out[k] = clean(v)
    }
    return out
  }
  return obj
}

const wipe = process.argv.includes('--wipe')

console.log(`\n  Project: ${cfg.projectId}\n`)

if (wipe) {
  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(db, name))
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db)
      for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref)
      await batch.commit()
    }
    console.log(`  cleared  ${name.padEnd(14)} ${snap.docs.length}`)
  }
  console.log('')
}

let total = 0
for (const name of COLLECTIONS) {
  const rows = data[name] ?? []
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(db)
    for (const row of rows.slice(i, i + 400)) {
      const { id, ...rest } = row
      batch.set(doc(db, name, id), clean(rest))
    }
    await batch.commit()
  }
  total += rows.length
  console.log(`  written  ${name.padEnd(14)} ${rows.length}`)
}

rmSync(tmpDir, { recursive: true, force: true })

console.log(`\n  Done — ${total} documents written.\n`)
process.exit(0)
