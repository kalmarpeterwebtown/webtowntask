import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ProfilePage } from '@/pages/ProfilePage'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'

const updateProfileMock = vi.fn()
const sendPasswordResetEmailMock = vi.fn()
const updateDocMock = vi.fn()
const changePasswordMock = vi.fn()

vi.mock('firebase/auth', () => ({
  updateProfile: (...args: unknown[]) => updateProfileMock(...args),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
}))

vi.mock('firebase/firestore', () => ({
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  serverTimestamp: () => 'server-timestamp',
}))

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
}))

vi.mock('@/utils/firestore', () => ({
  userRef: (uid: string) => ({ id: uid }),
}))

vi.mock('@/services/auth.service', () => ({
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
}))

describe('ProfilePage', () => {
  beforeEach(() => {
    updateProfileMock.mockReset()
    sendPasswordResetEmailMock.mockReset()
    updateDocMock.mockReset()
    changePasswordMock.mockReset()

    useAuthStore.setState({
      firebaseUser: {
        uid: 'user-1',
        email: 'dev@webtown.hu',
        providerData: [{ providerId: 'password' }],
      } as never,
      userProfile: {
        id: 'user-1',
        email: 'dev@webtown.hu',
        displayName: 'Dev User',
      } as never,
      claims: {},
      loading: false,
      initialized: true,
    })
    useOrgStore.setState({
      currentOrg: {
        id: 'org-1',
        name: 'Webtown Test Organisation',
        slug: 'webtown-test',
      } as never,
      memberships: [{ orgId: 'org-1' }] as never,
      membershipsLoaded: true,
      orgRole: 'admin',
      loading: false,
    })
  })

  afterEach(() => {
    cleanup()
    useAuthStore.setState({
      firebaseUser: null,
      userProfile: null,
      claims: {},
      loading: false,
      initialized: true,
    })
    useOrgStore.getState().reset()
  })

  it('validates mismatched new password confirmation', async () => {
    render(<ProfilePage />)

    fireEvent.change(screen.getByLabelText('Jelenlegi jelszó'), {
      target: { value: 'old-secret' },
    })
    fireEvent.change(screen.getByLabelText('Új jelszó'), {
      target: { value: 'new-secret-123' },
    })
    fireEvent.change(screen.getByLabelText('Új jelszó megerősítése'), {
      target: { value: 'different-secret' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Jelszó módosítása' }))

    expect(await screen.findByText('Az új jelszó és a megerősítés nem egyezik.')).toBeInTheDocument()
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('submits password change when the form is valid', async () => {
    changePasswordMock.mockResolvedValue(undefined)

    render(<ProfilePage />)

    fireEvent.change(screen.getByLabelText('Jelenlegi jelszó'), {
      target: { value: 'old-secret' },
    })
    fireEvent.change(screen.getByLabelText('Új jelszó'), {
      target: { value: 'new-secret-123' },
    })
    fireEvent.change(screen.getByLabelText('Új jelszó megerősítése'), {
      target: { value: 'new-secret-123' },
    })

    const passwordSection = screen.getByText('Jelszó').closest('section')
    expect(passwordSection).not.toBeNull()
    fireEvent.click(within(passwordSection as HTMLElement).getByRole('button', { name: 'Jelszó módosítása' }))

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith('old-secret', 'new-secret-123')
    })
    expect(await screen.findByText('A jelszavad sikeresen frissült.')).toBeInTheDocument()
    expect(screen.getByLabelText('Jelenlegi jelszó')).toHaveValue('')
  })

  it('shows reset email flow for non-password providers', async () => {
    sendPasswordResetEmailMock.mockResolvedValue(undefined)
    useAuthStore.setState({
      firebaseUser: {
        uid: 'user-2',
        email: 'google-user@webtown.hu',
        providerData: [{ providerId: 'google.com' }],
      } as never,
      userProfile: {
        id: 'user-2',
        email: 'google-user@webtown.hu',
        displayName: 'Google User',
      } as never,
    })

    render(<ProfilePage />)

    const helperMessages = screen.getAllByText(
      'Ennél a fióknál közvetlen jelszóváltás helyett emailes visszaállítás érhető el.',
    )
    expect(helperMessages.length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Jelszó-visszaállítási email küldése' }))

    await waitFor(() => {
      expect(sendPasswordResetEmailMock).toHaveBeenCalled()
    })
    expect(await screen.findByText(/Jelszó-visszaállítási emailt küldtük a/i)).toBeInTheDocument()
  })
})
