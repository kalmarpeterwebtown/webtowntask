import { useState, useEffect, type FormEvent } from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createStory } from '@/services/story.service'
import { useOrgStore } from '@/stores/orgStore'
import { toast } from '@/stores/uiStore'
import type { StoryLocation, StoryType, StoryPriority } from '@/types/enums'

interface StoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  defaultLocation?: StoryLocation
  afterOrder?: string
}

const TYPE_OPTIONS: { value: StoryType; label: string }[] = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'tech_debt', label: 'Tech debt' },
  { value: 'chore', label: 'Chore' },
]

const PRIORITY_OPTIONS: { value: StoryPriority; label: string }[] = [
  { value: 'critical', label: 'Kritikus' },
  { value: 'high', label: 'Magas' },
  { value: 'medium', label: 'Közepes' },
  { value: 'low', label: 'Alacsony' },
]

const LOCATION_LABELS: Record<StoryLocation, string> = {
  backlog: 'Backlog',
  planbox: 'Planbox',
  board: 'Board',
}

export function StoryFormModal({
  isOpen,
  onClose,
  projectId,
  defaultLocation = 'backlog',
  afterOrder,
}: StoryFormModalProps) {
  const { currentOrg } = useOrgStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<StoryType>('feature')
  const [priority, setPriority] = useState<StoryPriority>('medium')
  const [location, setLocation] = useState<StoryLocation>(defaultLocation)
  const [estimate, setEstimate] = useState('')
  const [loading, setLoading] = useState(false)
  const [titleError, setTitleError] = useState('')

  // Sync location when modal opens with a different defaultLocation
  useEffect(() => {
    if (isOpen) setLocation(defaultLocation)
  }, [isOpen, defaultLocation])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setTitleError('A cím kötelező.')
      return
    }
    if (!currentOrg) return

    setTitleError('')
    setLoading(true)
    try {
      await createStory(currentOrg.id, projectId, {
        title: title.trim(),
        description: description.trim(),
        type,
        priority,
        location,
        estimate: estimate ? Number(estimate) : undefined,
        afterOrder,
      })
      toast.success('Story létrehozva!')
      handleClose()
    } catch {
      toast.error('Nem sikerült létrehozni a story-t.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setDescription('')
    setType('feature')
    setPriority('medium')
    setLocation(defaultLocation)
    setEstimate('')
    setTitleError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Új story" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Cím"
          placeholder="Rövid, leíró cím..."
          value={title}
          onChange={(e) => { setTitle(e.target.value); setTitleError('') }}
          error={titleError}
          autoFocus
        />

        {/* Típus + Prioritás */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Típus</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              value={type}
              onChange={(e) => setType(e.target.value as StoryType)}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioritás</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              value={priority}
              onChange={(e) => setPriority(e.target.value as StoryPriority)}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Helye + Becslés */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Elhelyezés</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              value={location}
              onChange={(e) => setLocation(e.target.value as StoryLocation)}
            >
              {(Object.keys(LOCATION_LABELS) as StoryLocation[]).map((loc) => (
                <option key={loc} value={loc}>{LOCATION_LABELS[loc]}</option>
              ))}
            </select>
          </div>
          <Input
            label="Becslés (SP)"
            type="number"
            placeholder="pl. 3"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            min={0}
          />
        </div>

        {/* Leírás */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Leírás</label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
            rows={3}
            placeholder="Részletesebb leírás (opcionális)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <ModalFooter>
          <Button variant="ghost" type="button" onClick={handleClose} disabled={loading}>
            Mégse
          </Button>
          <Button type="submit" loading={loading}>
            Létrehozás
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
