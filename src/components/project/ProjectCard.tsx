import { useNavigate } from 'react-router-dom'
import { FolderOpen, ChevronRight } from 'lucide-react'
import { ROUTES } from '@/config/constants'
import type { Project } from '@/types/models'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(ROUTES.BACKLOG(project.id))}
      className="group w-full text-left rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-primary-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        {/* Ikon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100 transition-colors">
          <FolderOpen className="h-5 w-5" />
        </div>

        {/* Tartalom */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {project.prefix}
            </span>
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">
              {project.name}
            </h3>
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{project.description}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            {project.storyCount} story
          </p>
        </div>

        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary-400 shrink-0 transition-colors" />
      </div>
    </button>
  )
}
