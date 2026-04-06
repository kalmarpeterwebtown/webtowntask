import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

const isTestMode = import.meta.env.MODE === 'test'

function getFirebaseEnv(key: string, fallback = '') {
  const value = import.meta.env[key]
  if (typeof value === 'string' && value.trim().length > 0) return value
  return isTestMode ? fallback : value
}

// Firebase konfiguráció — env változókból töltjük be
// Fejlesztéshez: .env.local fájlban add meg a valós értékeket
const firebaseConfig = {
  apiKey:            getFirebaseEnv('VITE_FIREBASE_API_KEY', 'test-api-key'),
  authDomain:        getFirebaseEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test-project.firebaseapp.com'),
  projectId:         getFirebaseEnv('VITE_FIREBASE_PROJECT_ID', 'test-project'),
  storageBucket:     getFirebaseEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test-project.firebasestorage.app'),
  messagingSenderId: getFirebaseEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '1234567890'),
  appId:             getFirebaseEnv('VITE_FIREBASE_APP_ID', '1:1234567890:web:testappid'),
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Firestore offline persistence engedélyezve (multi-tab support)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

// Fallback: ha az initializeFirestore már megtörtént, a getFirestore visszaadja
export const getDb = () => getFirestore(app)

export const storage = getStorage(app)
export const functions = getFunctions(app, 'europe-west1')
