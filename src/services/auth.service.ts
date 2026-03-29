import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { auth } from '@/config/firebase'
import { userRef } from '@/utils/firestore'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

async function ensureUserProfile(user: User) {
  await setDoc(userRef(user.uid), {
    email: user.email ?? '',
    displayName: user.displayName ?? user.email ?? 'Felhasználó',
    photoUrl: user.photoURL ?? null,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider)
  await ensureUserProfile(cred.user)
  return cred
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  await ensureUserProfile(cred.user)
  await setDoc(userRef(cred.user.uid), {
    currentOrgId: null,
  }, { merge: true })
  return cred
}

export async function signOut() {
  return firebaseSignOut(auth)
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email)
}

export async function refreshClaims() {
  const user = auth.currentUser
  if (user) {
    await user.getIdToken(true)
    return user.getIdTokenResult()
  }
  return null
}
