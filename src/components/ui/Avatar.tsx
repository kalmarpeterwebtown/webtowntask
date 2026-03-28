import { clsx } from 'clsx'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: AvatarSize
  className?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

function getColor(name: string) {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500',
    'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31
  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({ src, name = '', size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx('rounded-full object-cover', sizeClasses[size], className)}
      />
    )
  }

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        getColor(name || '?'),
        sizeClasses[size],
        className,
      )}
      title={name}
    >
      {name ? getInitials(name) : '?'}
    </div>
  )
}

export function AvatarGroup({
  users,
  max = 4,
  size = 'sm',
}: {
  users: Array<{ name?: string; photoUrl?: string | null }>
  max?: number
  size?: AvatarSize
}) {
  const visible = users.slice(0, max)
  const extra = users.length - max

  return (
    <div className="flex -space-x-1.5">
      {visible.map((u, i) => (
        <Avatar
          key={i}
          src={u.photoUrl}
          name={u.name}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {extra > 0 && (
        <div
          className={clsx(
            'flex items-center justify-center rounded-full bg-gray-200 ring-2 ring-white text-gray-600 font-medium',
            sizeClasses[size],
          )}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
