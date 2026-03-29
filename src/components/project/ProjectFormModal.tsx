import { useState, type FormEvent } from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createProject } from '@/services/project.service'
import { useOrgStore } from '@/stores/orgStore'
import { toast } from '@/stores/uiStore'

interface ProjectFormModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (projectId: string) => void
}

export function ProjectFormModal({ isOpen, onClose, onCreated }: ProjectFormModalProps) {
  const { currentOrg } = useOrgStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prefix, setPrefix] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleNameChange = (value: string) => {
    setName(value)
    if (!prefix) {
      setPrefix(
        value
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 4),
      )
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'A projekt neve kötelező.'
    if (!prefix.trim()) errs.prefix = 'Az azonosító prefix kötelező.'
    if (prefix.length > 6) errs.prefix = 'Max 6 karakter.'
    return errs
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    if (!currentOrg) return

    setLoading(true)
    try {
      const projectId = await createProject(currentOrg.id, {
        name: name.trim(),
        description: description.trim(),
        prefix: prefix.trim(),
      })
      toast.success('Projekt létrehozva!')
      handleClose()
      onCreated?.(projectId)
    } catch {
      toast.error('Nem sikerült létrehozni a projektet.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setPrefix('')
    setErrors({})
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Új projekt" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Projekt neve"
          placeholder="pl. Webtown webshop"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          error={errors.name}
          autoFocus
        />

        <Input
          label="Leírás"
          placeholder="Rövid leírás (opcionális)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Input
          label="Story ID prefix"
          placeholder="pl. WEB"
          value={prefix}
          onChange={(e) =>
            setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
          }
          error={errors.prefix}
          helper="A story azonosítók eleje: WEB-1, WEB-2..."
        />

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
