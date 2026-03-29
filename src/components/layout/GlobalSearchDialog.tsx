import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { FolderKanban, Search, Users, FileText, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useUiStore } from '@/stores/uiStore'
import { useOrgStore } from '@/stores/orgStore'
import { useProjects } from '@/hooks/useProjects'
import { useProjectAccessMap, useTeamAccessMap } from '@/hooks/useAccess'
import { subscribeToTeams } from '@/services/team.service'
import { storiesRef } from '@/utils/firestore'
import type { Project, Story, Team } from '@/types/models'

type SearchResult =
  | { id: string; type: 'project'; title: string; subtitle: string; to: string; icon: typeof FolderKanban }
  | { id: string; type: 'team'; title: string; subtitle: string; to: string; icon: typeof Users }
  | { id: string; type: 'story'; title: string; subtitle: string; to: string; icon: typeof FileText }

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function createProjectResults(projects: Project[]): SearchResult[] {
  return projects.map((project) => ({
    id: `project-${project.id}`,
    type: 'project',
    title: project.name,
    subtitle: `${project.prefix}${project.description ? ` · ${project.description}` : ''}`,
    to: `/projects/${project.id}`,
    icon: FolderKanban,
  }))
}

function createTeamResults(teams: Team[]): SearchResult[] {
  return teams.map((team) => ({
    id: `team-${team.id}`,
    type: 'team',
    title: team.name,
    subtitle: team.description || 'Csapat board és sprint nézet',
    to: `/teams/${team.id}/board`,
    icon: Users,
  }))
}

function createStoryResults(stories: Story[], projectsById: Record<string, Project>): SearchResult[] {
  return stories.map((story) => {
    const project = projectsById[story.projectId]
    const storyCode = project ? `${project.prefix}-${story.sequenceNumber}` : story.id
    const assigneeText = story.assigneeNames.length > 0 ? ` · ${story.assigneeNames.join(', ')}` : ''
    return {
      id: `story-${story.id}`,
      type: 'story',
      title: story.title,
      subtitle: `${storyCode}${assigneeText}${story.description ? ` · ${story.description}` : ''}`,
      to: `/projects/${story.projectId}/stories/${story.id}`,
      icon: FileText,
    }
  })
}

export function GlobalSearchDialog() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { currentOrg } = useOrgStore()
  const { searchOpen, setSearchOpen } = useUiStore()
  const { projects: allProjects, loading: projectsLoading } = useProjects()
  const { projects, loading: projectAccessLoading } = useProjectAccessMap(allProjects)
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const { teams, loading: teamAccessLoading } = useTeamAccessMap(allTeams)
  const [stories, setStories] = useState<Story[]>([])
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const closeSearch = useCallback(() => {
    setQuery('')
    setSearchOpen(false)
  }, [setSearchOpen])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const { searchOpen: currentSearchOpen } = useUiStore.getState()
        if (currentSearchOpen) {
          closeSearch()
        } else {
          useUiStore.getState().setSearchOpen(true)
        }
      }

      if (event.key === 'Escape') {
        closeSearch()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [closeSearch])

  useEffect(() => {
    if (!currentOrg?.id) {
      return
    }

    return subscribeToTeams(currentOrg.id, setAllTeams)
  }, [currentOrg?.id])

  useEffect(() => {
    if (!currentOrg?.id || projects.length === 0) {
      return
    }

    const storyMap = new Map<string, Story>()
    const unsubs = projects.map((project) =>
      onSnapshot(storiesRef(currentOrg.id, project.id), (snap) => {
        for (const [id, story] of storyMap.entries()) {
          if (story.projectId === project.id) {
            storyMap.delete(id)
          }
        }

        snap.docs.forEach((doc) => {
          storyMap.set(doc.id, { id: doc.id, ...doc.data() } as Story)
        })

        setStories(Array.from(storyMap.values()))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [currentOrg?.id, projects])

  useEffect(() => {
    if (!searchOpen) return

    const timeout = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(timeout)
  }, [searchOpen])

  const projectResults = useMemo(() => createProjectResults(projects), [projects])
  const teamResults = useMemo(
    () => createTeamResults(currentOrg?.id ? teams : []),
    [currentOrg?.id, teams],
  )
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project])),
    [projects],
  )
  const storyResults = useMemo(
    () => createStoryResults(currentOrg?.id && projects.length > 0 ? stories : [], projectMap),
    [currentOrg?.id, projects.length, stories, projectMap],
  )
  const normalizedQuery = normalize(deferredQuery.trim())

  const filteredResults = useMemo(() => {
    const allResults = [...projectResults, ...teamResults, ...storyResults]
    if (!normalizedQuery) {
      return {
        projects: projectResults.slice(0, 4),
        teams: teamResults.slice(0, 4),
        stories: storyResults.slice(0, 6),
      }
    }

    const matches = allResults.filter((result) =>
      normalize(`${result.title} ${result.subtitle}`).includes(normalizedQuery),
    )

    return {
      projects: matches.filter((result) => result.type === 'project').slice(0, 5),
      teams: matches.filter((result) => result.type === 'team').slice(0, 5),
      stories: matches.filter((result) => result.type === 'story').slice(0, 8),
    }
  }, [normalizedQuery, projectResults, teamResults, storyResults])

  const totalResults =
    filteredResults.projects.length + filteredResults.teams.length + filteredResults.stories.length
  const loading = projectsLoading || projectAccessLoading || teamAccessLoading

  const handleNavigate = (to: string) => {
    closeSearch()
    navigate(to)
  }

  if (!searchOpen) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-navy-950/50 px-4 py-10 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Kereső bezárása"
        onClick={closeSearch}
      />

      <div className="relative z-[91] w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl ring-1 ring-black/5">
        <div className="border-b border-gray-100 bg-gradient-to-r from-white via-gray-50 to-primary-50/40 px-5 py-4">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Keresés projektekben, csapatokban, storykban, leírásokban..."
              className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
            <kbd className="hidden rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-400 sm:block">
              ESC
            </kbd>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <p>Globális gyorskereső a teljes workspace-ben</p>
            <p>{loading ? 'Találatok frissítése...' : `${totalResults} találat`}</p>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          <SearchSection
            title="Projektek"
            emptyLabel="Nincs találat projektre"
            results={filteredResults.projects}
            onSelect={handleNavigate}
          />
          <SearchSection
            title="Csapatok"
            emptyLabel="Nincs találat csapatra"
            results={filteredResults.teams}
            onSelect={handleNavigate}
          />
          <SearchSection
            title="Storyk"
            emptyLabel="Nincs találat storyra"
            results={filteredResults.stories}
            onSelect={handleNavigate}
          />

          {!loading && totalResults === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
              <p className="text-sm font-medium text-gray-700">Nincs találat</p>
              <p className="mt-1 text-sm text-gray-500">
                Próbálj projektnevet, story címet, azonosítót vagy leírásrészletet keresni.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SearchSection({
  title,
  emptyLabel,
  results,
  onSelect,
}: {
  title: string
  emptyLabel: string
  results: SearchResult[]
  onSelect: (to: string) => void
}) {
  return (
    <section className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center justify-between px-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</h3>
        <span className="text-xs text-gray-400">{results.length}</span>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-transparent px-3 py-3 text-sm text-gray-400">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((result) => {
            const Icon = result.icon
            return (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelect(result.to)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-sm transition-all',
                  'hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-md',
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{result.title}</p>
                  <p className="truncate text-sm text-gray-500">{result.subtitle}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
