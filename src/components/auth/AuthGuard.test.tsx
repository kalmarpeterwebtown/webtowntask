import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthGuard, OrgGuard } from '@/components/auth/AuthGuard'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'

function LoginProbe() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? ''

  return (
    <div>
      <div>login-page</div>
      <div data-testid="redirect-from">{from}</div>
    </div>
  )
}

function ProtectedShell() {
  return <Outlet />
}

describe('AuthGuard', () => {
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

  it('redirects anonymous users to login and preserves the target path', async () => {
    useAuthStore.setState({
      firebaseUser: null,
      userProfile: null,
      claims: {},
      loading: false,
      initialized: true,
    })

    render(
      <MemoryRouter initialEntries={['/projects/demo?tab=backlog']}>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route element={<ProtectedShell />}>
              <Route path="/projects/:projectId" element={<div>private-page</div>} />
            </Route>
          </Route>
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('login-page')).toBeInTheDocument()
    expect(screen.getByTestId('redirect-from')).toHaveTextContent('/projects/demo?tab=backlog')
  })

  it('renders protected content for authenticated users', async () => {
    useAuthStore.setState({
      firebaseUser: { uid: 'user-1' } as never,
      userProfile: null,
      claims: {},
      loading: false,
      initialized: true,
    })

    render(
      <MemoryRouter initialEntries={['/projects/demo']}>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/projects/:projectId" element={<div>private-page</div>} />
          </Route>
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('private-page')).toBeInTheDocument()
  })
})

describe('OrgGuard', () => {
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

  it('redirects to setup when no organization can be resolved', async () => {
    useAuthStore.setState({
      firebaseUser: { uid: 'user-1' } as never,
      userProfile: null,
      claims: {},
      loading: false,
      initialized: true,
    })
    useOrgStore.setState({
      currentOrg: null,
      memberships: [],
      membershipsLoaded: true,
      orgRole: null,
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<OrgGuard />}>
            <Route path="/dashboard" element={<div>org-page</div>} />
          </Route>
          <Route path="/setup" element={<div>setup-page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('setup-page')).toBeInTheDocument()
  })

  it('keeps loading while organization resolution is still in progress', async () => {
    useAuthStore.setState({
      firebaseUser: { uid: 'user-1' } as never,
      userProfile: {
        id: 'user-1',
        email: 'dev@webtown.hu',
        displayName: 'Dev User',
        currentOrgId: 'org-1',
      } as never,
      claims: {},
      loading: false,
      initialized: true,
    })
    useOrgStore.setState({
      currentOrg: null,
      memberships: [],
      membershipsLoaded: true,
      orgRole: null,
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<OrgGuard />}>
            <Route path="/dashboard" element={<div>org-page</div>} />
          </Route>
          <Route path="/setup" element={<div>setup-page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Betöltés...')).toBeInTheDocument()
    expect(screen.queryByText('setup-page')).not.toBeInTheDocument()
  })

  it('renders protected org content when current organization exists', async () => {
    useAuthStore.setState({
      firebaseUser: { uid: 'user-1' } as never,
      userProfile: null,
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

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<OrgGuard />}>
            <Route path="/dashboard" element={<div>org-page</div>} />
          </Route>
          <Route path="/setup" element={<div>setup-page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('org-page')).toBeInTheDocument()
  })
})
