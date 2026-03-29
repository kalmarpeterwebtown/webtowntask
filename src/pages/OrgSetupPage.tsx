import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { WebtownLogo } from '@/components/branding/WebtownLogo'
import { createOrganization } from '@/services/organization.service'
import { useOrgStore } from '@/stores/orgStore'
import { ROUTES } from '@/config/constants'

export function OrgSetupPage() {
  const navigate = useNavigate()
  const { setCurrentOrg } = useOrgStore()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-generál slug-ot a névből
    setSlug(
      value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .slice(0, 32),
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('A szervezet neve kötelező.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const org = await createOrganization(name.trim(), slug || name.trim())
      // Set org immediately so OrgGuard doesn't redirect back to /setup before
      // the Firestore onSnapshot fires with the updated currentOrgId.
      setCurrentOrg(org)
      navigate(ROUTES.DASHBOARD, { replace: true })
    } catch (err) {
      setError('Nem sikerült létrehozni a szervezetet. Próbáld újra.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex justify-center">
            <WebtownLogo variant="light" className="h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white">Hozd létre a szervezeted</h1>
          <p className="mt-1 text-sm text-white/50">
            Egy szervezeten belül kezelheted a projektjeidet és csapataidat.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Szervezet neve"
              placeholder="pl. Webtown Kft."
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="URL azonosító (slug)"
              placeholder="webtown-kft"
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '')
                    .replace(/-+/g, '-'),
                )
              }
              helper="Kisbetűk, számok és kötőjel használható."
            />

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={loading}
            >
              Szervezet létrehozása
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
