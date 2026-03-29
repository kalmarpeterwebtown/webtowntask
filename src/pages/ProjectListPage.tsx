import { useState } from 'react'
import { Plus, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProjectCard } from '@/components/project/ProjectCard'
import { ProjectFormModal } from '@/components/project/ProjectFormModal'
import { useProjects } from '@/hooks/useProjects'

export function ProjectListPage() {
  const { projects, loading } = useProjects()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Fejléc */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projektek</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '...' : `${projects.length} aktív projekt`}
          </p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowForm(true)}
        >
          Új projekt
        </Button>
      </div>

      {/* Tartalom */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="Még nincs projekt"
          description="Hozd létre az első projektedet és kezdj el story-kat felvenni."
          action={
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setShowForm(true)}
            >
              Új projekt
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ProjectFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  )
}
