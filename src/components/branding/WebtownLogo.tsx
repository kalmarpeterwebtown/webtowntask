import { clsx } from 'clsx'

type WebtownLogoVariant = 'light' | 'dark' | 'brand'

interface WebtownLogoProps {
  variant?: WebtownLogoVariant
  className?: string
  alt?: string
}

const logoByVariant: Record<WebtownLogoVariant, string> = {
  light: 'brand/webtown-logo-white.svg',
  dark: 'brand/webtown-logo-black.svg',
  brand: 'brand/webtown-logo.svg',
}

export function WebtownLogo({
  variant = 'dark',
  className,
  alt = 'Webtown',
}: WebtownLogoProps) {
  const src = `${import.meta.env.BASE_URL}${logoByVariant[variant]}`

  return (
    <img
      src={src}
      alt={alt}
      className={clsx('block h-auto w-auto', className)}
    />
  )
}
