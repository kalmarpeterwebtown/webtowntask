import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProjectListPage } from '@/pages/ProjectListPage'

const useProjectsMock = vi.fn()
const useProjectAccessMapMock = vi.fn()
const useOrgStoreMock = vi.fn()

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => useProjectsMock(),
}))

vi.mock('@/hooks/useAccess', () => ({
  useProjectAccessMap: (...args: unknown[]) => useProjectAccessMapMock(...args),
}))

vi.mock('@/stores/orgStore', () => ({
  useOrgStore: () => useOrgStoreMock(),
}))

vi.mock('@/components/project/ProjectCard', () => ({
  ProjectCard: ({ project }: { project: { id: string; name: string } }) => (
    <div data-testid="project-card">{project.name}</div>
  ),
}))

vi.mock('@/components/project/ProjectFormModal', () => ({
  ProjectFormModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="project-form-modal">{isOpen ? 'open' : 'closed'}</div>
  ),
}))

describe('ProjectListPage', () => {
  beforeEach(() => {
    useProjectsMock.mockReset()
    useProjectAccessMapMock.mockReset()
    useOrgStoreMock.mockReset()

    useOrgStoreMock.mockReturnValue({
      currentOrg: { id: 'org-1', name: 'Webtown Test Organisation', slug: 'webtown-test' },
      loading: false,
    })
    useProjectsMock.mockReturnValue({
      projects: [],
      loading: false,
      error: null,
    })
    useProjectAccessMapMock.mockReturnValue({
      projects: [],
      loading: false,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders an org loading hint when organization is still resolving', () => {
    useOrgStoreMock.mockReturnValue({
      currentOrg: null,
      loading: true,
    })

    render(<ProjectListPage />)

    expect(screen.getByText('Szervezet betöltése...')).toBeInTheDocument()
  })

  it('renders a friendly error when project loading fails', () => {
    useProjectsMock.mockReturnValue({
      projects: [],
      loading: false,
      error: 'A projektek betöltése átmenetileg nem sikerült.',
    })

    render(<ProjectListPage />)

    expect(screen.getByText('A projektek betöltése átmenetileg nem sikerült.')).toBeInTheDocument()
  })

  it('shows empty state when no visible projects are assigned', () => {
    render(<ProjectListPage />)

    expect(screen.getByText('Nincs látható projekt')).toBeInTheDocument()
    expect(screen.getByText(/Még nincs hozzád rendelt projekt/i)).toBeInTheDocument()
  })

  it('renders visible project cards and opens the create modal', () => {
    useProjectsMock.mockReturnValue({
      projects: [{ id: 'project-1', name: 'Alpha', status: 'active' }],
      loading: false,
      error: null,
    })
    useProjectAccessMapMock.mockReturnValue({
      projects: [{ id: 'project-1', name: 'Alpha', status: 'active' }],
      loading: false,
    })

    render(<ProjectListPage />)

    expect(screen.getByText('1 aktív projekt')).toBeInTheDocument()
    expect(screen.getByTestId('project-card')).toHaveTextContent('Alpha')
    expect(screen.getByTestId('project-form-modal')).toHaveTextContent('closed')

    fireEvent.click(screen.getAllByRole('button', { name: 'Új projekt' })[0]!)
    expect(screen.getByTestId('project-form-modal')).toHaveTextContent('open')
  })
})
