import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { auth } from '@/config/firebase'
import { userRef } from '@/utils/firestore'

const googleProvider = new GoogleAuthProvider()

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  await setDoc(userRef(cred.user.uid), {
    email,
    displayName,
    photoUrl: null,
    currentOrgId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
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
