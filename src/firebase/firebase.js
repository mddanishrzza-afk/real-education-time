// ============================================================
// Firebase initialization
// Reads credentials from Vite environment variables (.env file)
// ============================================================
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Clear, user-friendly error if Firebase is not configured yet
const missing = Object.entries(firebaseConfig)
  .filter(([key, val]) => !val || String(val).includes('YOUR_'))
  .map(([key]) => key)

if (missing.length > 0) {
  console.warn(
    `[REAL EDUCATION TIME] Firebase is not fully configured yet. Missing: ${missing.join(
      ', '
    )}. ` +
      `Copy .env.example to .env and paste your Firebase config values. ` +
      `Until then, the app will run in "setup" mode and features requiring a backend will show setup messages.`
  )
}

let app = null
let auth = null
let db = null
let storage = null

const isConfigured = missing.length === 0

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    storage = getStorage(app)
  } catch (err) {
    console.error('[REAL EDUCATION TIME] Firebase initialization error:', err)
  }
}

export { app, auth, db, storage, isConfigured }
