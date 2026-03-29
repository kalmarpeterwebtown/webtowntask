import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Check, Archive } from 'lucide-react'
import { onSnapshot } from 'firebase/firestore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOrgStore } from '@/stores/orgStore'
import { updateProject, archiveProject } from '@/services/project.service'
import { projectRef } from '@/utils/firestore'
import { ROUTES } from '@/config/constants'
import type { Project } from '@/types/models'
import type { StoryType } from '@/types/enums'

const ALL_STORY_TYPES: { value: StoryType; label: string }[] = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'tech_debt', label: 'Tech Debt' },
  { value: 'chore', label: 'Chore' },
]

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { currentOrg } = useOrgStore()
  const [project, setProject] = useState<Project | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prefix, setPrefix] = useState('')
  const [storyTypes, setStoryTypes] = useState<StoryType[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    if (!currentOrg || !projectId) return
    const unsub = onSnapshot(projectRef(currentOrg.id, projectId), (snap) => {
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() } as Project
        setProject(p)
        setName(p.name)
        setDescription(p.description ?? '')
        setPrefix(p.prefix)
        setStoryTypes(p.settings.storyTypes)
      }
    })
    return unsub
  }, [currentOrg?.id, projectId])

  const handleSave = async () => {
    if (!currentOrg || !projectId || !name.trim()) return
    setSaving(true)
    try {
      await updateProject(currentOrg.id, projectId, {
        name: name.trim(),
        description: description.trim(),
        prefix,
        settings: {
          storyTypes,
          priorities: project?.settings.priorities ?? ['critical', 'high', 'medium', 'low'],
        },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!currentOrg || !projectId) return
    if (!confirm('Biztosan archiválod a projektet? Az adatok megmaradnak, de a projekt nem lesz aktív.')) return
    setArchiving(true)
    try {
      await archiveProject(currentOrg.id, projectId)
    } finally {
      setArchiving(false)
    }
  }

  const toggleType = (type: StoryType) => {
    setStoryTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  if (!project) {
    return (
      <div className="p-6 flex justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <Link
        to={ROUTES.PROJECT(project.id)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Vissza a projekthez
      </Link>

      <h1 className="text-xl font-semibold text-gray-900">Projekt beállítások</h1>

      {/* Alapadatok */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Alapadatok</h2>
        <div>
          <label className="block mb-1 text-xs font-medium text-gray-600">Projekt neve</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Projekt neve" className="max-w-sm" />
        </div>
        <div>
          <label className="block mb-1 text-xs font-medium text-gray-600">Leírás</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Rövid leírás..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-primary-500 focus:outline-none resize-none"
          />
        </div>
        <div>
          <label className="block mb-1 text-xs font-medium text-gray-600">Story ID prefix</label>
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="WEB"
            className="max-w-[120px] uppercase"
          />
          <p className="mt-1 text-xs text-gray-400">Pl. WEB → WEB-1, WEB-2, …</p>
        </div>
      </section>

      {/* Story típusok */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Story típusok</h2>
        <p className="mb-3 text-xs text-gray-500">Melyik típusokat engedélyezed ennél a projektnél?</p>
        <div className="flex flex-wrap gap-2">
          {ALL_STORY_TYPES.map(({ value, label }) => {
            const active = storyTypes.includes(value)
            return (
              <button
                key={value}
                onClick={() => toggleType(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  active
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      <div className="flex gap-3">
        <Button onClick={handleSave} loading={saving} variant={saved ? 'secondary' : 'primary'} className="gap-1.5">
          {saved ? <><Check className="h-4 w-4" /> Mentve</> : 'Mentés'}
        </Button>
      </div>

      {/* Veszélyzóna */}
      <section className="border-t border-gray-200 pt-6">
        <h2 className="mb-1 text-sm font-semibold text-red-600">Veszélyzóna</h2>
        <p className="mb-3 text-xs text-gray-500">Az archiválás visszafordítható, de a projekt eltűnik az aktív listából.</p>
        <Button
          variant="danger"
          loading={archiving}
          icon={<Archive className="h-4 w-4" />}
          onClick={handleArchive}
        >
          Projekt archiválása
        </Button>
      </section>
    </div>
  )
}
