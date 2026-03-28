import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { useUiStore } from '@/stores/uiStore'

const icons = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error:   <AlertCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info:    <Info className="h-5 w-5 text-blue-500" />,
}

const bgClasses = {
  success: 'border-green-200 bg-green-50',
  error:   'border-red-200 bg-red-50',
  warning: 'border-yellow-200 bg-yellow-50',
  info:    'border-blue-200 bg-blue-50',
}

export function ToastContainer() {
  const { toasts, removeToast } = useUiStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
            'min-w-[280px] max-w-sm animate-in slide-in-from-right-4 duration-200',
            bgClasses[t.type],
          )}
        >
          {icons[t.type]}
          <p className="flex-1 text-sm text-gray-800">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
