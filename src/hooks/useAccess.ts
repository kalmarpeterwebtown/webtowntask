import { useEffect, useMemo, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { projectMemberRef, teamMemberRef } from '@/utils/firestore'
import { isOrgAdmin } from '@/utils/permissions'
import type {
  Project,
  Team,
  ProjectMembership,
  TeamMembership,
} from '@/types/models'
import type { AccessLevel } from '@/types/enums'

function buildIdKey(ids: string[]) {
  return ids.slice().sort().join(',')
}

export function useProjectAccessMap(projects: Project[]) {
  const { currentOrg, memberships, orgRole } = useOrgStore()
  const { firebaseUser } = useAuthStore()
  const orgId = currentOrg?.id ?? null
  const userId = firebaseUser?.uid ?? null
  const membershipRole = orgId
    ? memberships.find((membership) => membership.id === orgId)?.role
    : undefined
  const effectiveOrgRole = orgRole ?? membershipRole
  const isAdmin = isOrgAdmin(effectiveOrgRole)
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects])
  const projectIdsKey = useMemo(() => buildIdKey(projectIds), [projectIds])
  const [accessByProjectId, setAccessByProjectId] = useState<Record<string, AccessLevel | null>>({})
  const [readyByProjectId, setReadyByProjectId] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isAdmin || !orgId || !userId || projectIds.length === 0) {
      return
    }

    const unsubs = projectIds.map((projectId) =>
      onSnapshot(projectMemberRef(orgId, projectId, userId), (snap) => {
        setAccessByProjectId((prev) => ({
          ...prev,
          [projectId]: snap.exists() ? (snap.data() as ProjectMembership).access : null,
        }))
        setReadyByProjectId((prev) => ({ ...prev, [projectId]: true }))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [isAdmin, orgId, userId, projectIdsKey, projectIds])

  const effectiveAccessByProjectId = useMemo(() => {
    if (isAdmin) {
      return Object.fromEntries(projectIds.map((projectId) => [projectId, 'manage'])) as Record<string, AccessLevel>
    }
    if (!orgId || !userId) return {}
    return accessByProjectId
  }, [isAdmin, orgId, userId, projectIds, accessByProjectId])

  const visibleProjects = useMemo(
    () => projects.filter((project) => Boolean(effectiveAccessByProjectId[project.id])),
    [projects, effectiveAccessByProjectId],
  )

  const loading = !isAdmin && !!orgId && !!userId && projectIds.length > 0 && projectIds.some((projectId) => !readyByProjectId[projectId])

  return {
    accessByProjectId: effectiveAccessByProjectId,
    projects: isAdmin ? projects : visibleProjects,
    loading,
  }
}

export function useTeamAccessMap(teams: Team[]) {
  const { currentOrg, memberships, orgRole } = useOrgStore()
  const { firebaseUser } = useAuthStore()
  const orgId = currentOrg?.id ?? null
  const userId = firebaseUser?.uid ?? null
  const membershipRole = orgId
    ? memberships.find((membership) => membership.id === orgId)?.role
    : undefined
  const effectiveOrgRole = orgRole ?? membershipRole
  const isAdmin = isOrgAdmin(effectiveOrgRole)
  const teamIds = useMemo(() => teams.map((team) => team.id), [teams])
  const teamIdsKey = useMemo(() => buildIdKey(teamIds), [teamIds])
  const [accessByTeamId, setAccessByTeamId] = useState<Record<string, AccessLevel | null>>({})
  const [readyByTeamId, setReadyByTeamId] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isAdmin || !orgId || !userId || teamIds.length === 0) {
      return
    }

    const unsubs = teamIds.map((teamId) =>
      onSnapshot(teamMemberRef(orgId, teamId, userId), (snap) => {
        setAccessByTeamId((prev) => ({
          ...prev,
          [teamId]: snap.exists() ? (snap.data() as TeamMembership).access : null,
        }))
        setReadyByTeamId((prev) => ({ ...prev, [teamId]: true }))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [isAdmin, orgId, userId, teamIdsKey, teamIds])

  const effectiveAccessByTeamId = useMemo(() => {
    if (isAdmin) {
      return Object.fromEntries(teamIds.map((teamId) => [teamId, 'manage'])) as Record<string, AccessLevel>
    }
    if (!orgId || !userId) return {}
    return accessByTeamId
  }, [isAdmin, orgId, userId, teamIds, accessByTeamId])

  const visibleTeams = useMemo(
    () => teams.filter((team) => Boolean(effectiveAccessByTeamId[team.id])),
    [teams, effectiveAccessByTeamId],
  )

  const loading = !isAdmin && !!orgId && !!userId && teamIds.length > 0 && teamIds.some((teamId) => !readyByTeamId[teamId])

  return {
    accessByTeamId: effectiveAccessByTeamId,
    teams: isAdmin ? teams : visibleTeams,
    loading,
  }
}
