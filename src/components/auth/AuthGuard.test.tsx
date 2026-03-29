import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthGuard } from '@/components/auth/AuthGuard'
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
