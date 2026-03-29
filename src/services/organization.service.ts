import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  collection,
} from 'firebase/firestore'
import { db, auth } from '@/config/firebase'
import { orgRef, userRef } from '@/utils/firestore'
import type { Organization } from '@/types/models'

/**
 * Új szervezet létrehozása.
 * Az első szervezetnél még nincs custom claim, ezért
 * a user doc `currentOrgId` mezőjébe is beírja az orgId-t (fallback).
 */
export async function createOrganization(
  name: string,
  slug: string,
): Promise<Organization> {
  const user = auth.currentUser
  if (!user) throw new Error('Nincs bejelentkezett felhasználó')

  const orgDocRef = doc(collection(db, 'organizations'))
  const orgId = orgDocRef.id
  const cleanSlug = slug.toLowerCase().replace(/\s+/g, '-')

  const orgData = {
    name,
    slug: cleanSlug,
    logoUrl: null,
    settings: {
      defaultEstimateType: 'points' as const,
      hoursPerDay: 8,
      clientCommentingEnabled: false,
      estimateRequiredForPlanbox: false,
    },
    plan: 'free' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid,
  }

  // 1. Org doc létrehozása
  await setDoc(orgDocRef, orgData)

  // 2. Owner membership doc (rules: createdBy == uid() allow create)
  await setDoc(
    doc(db, 'organizations', orgId, 'members', user.uid),
    {
      userId: user.uid,
      email: user.email,
      displayName: user.displayName ?? user.email ?? 'Felhasználó',
      role: 'owner',
      joinedAt: serverTimestamp(),
    },
  )

  // 3. User profil frissítése — currentOrgId fallback custom claim helyett
  await updateDoc(userRef(user.uid), {
    currentOrgId: orgId,
    updatedAt: serverTimestamp(),
  })

  // Return the org object so callers can set it optimistically in the store
  return { id: orgId, ...orgData } as unknown as Organization
}

export async function updateOrganization(
  orgId: string,
  data: Partial<Pick<Organization, 'name' | 'slug' | 'logoUrl' | 'settings'>>,
): Promise<void> {
  await updateDoc(orgRef(orgId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToOrg(
  orgId: string,
  callback: (org: Organization | null) => void,
): () => void {
  return onSnapshot(orgRef(orgId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as Organization)
    } else {
      callback(null)
    }
  })
}
