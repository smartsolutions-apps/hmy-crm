import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True only when a real project is configured — otherwise we run on demo data. */
export const firebaseEnabled = Boolean(cfg.apiKey && cfg.projectId)

let app: FirebaseApp | null = null
let dbInstance: Firestore | null = null

if (firebaseEnabled) {
  app = initializeApp(cfg as Required<typeof cfg>)
  dbInstance = getFirestore(app)
}

export const firestore = dbInstance
export const projectId = cfg.projectId as string | undefined
