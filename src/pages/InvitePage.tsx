import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { AuthShell } from './LoginPage'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { ROUTES } from '@/config/constants'

// A tényleges meghívó elfogadás Cloud Function-on keresztül történik.
// Ez az oldal csak a token validálást és az UX flow-t kezeli.
export function InvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const { firebaseUser } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted'>('loading')
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }

    // TODO: Cloud Function hívás a token validáláshoz
    // Egyelőre szimuláljuk
    setTimeout(() => {
      setOrgName('Webtown')
      setStatus('valid')
    }, 800)
  }, [token])

  const handleAccept = async () => {
    if (!firebaseUser) {
      // Nincs bejelentkezve — redirect login-ra, majd visszajön
      navigate(`${ROUTES.LOGIN}?redirect=/invite?token=${token}`)
      return
    }
    // TODO: Cloud Function hívás: acceptInvitation({ token })
    setStatus('accepted')
  }

  if (status === 'loading') {
    return (
      <AuthShell title="Meghívó ellenőrzése" subtitle="">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      </AuthShell>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthShell title="Érvénytelen meghívó" subtitle="">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <XCircle className="h-12 w-12 text-red-400" />
          <p className="text-sm text-gray-600">
            Ez a meghívó link lejárt vagy érvénytelen.
            Kérd meg az adminisztrátort, hogy küldjön új meghívót.
          </p>
          <Link to={ROUTES.LOGIN} className="text-sm text-primary-600 hover:underline">
            Vissza a bejelentkezéshez
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (status === 'accepted') {
    return (
      <AuthShell title="Sikeresen csatlakoztál!" subtitle={orgName}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="text-sm text-gray-600">
            Üdvözlünk a <strong>{orgName}</strong> szervezetben!
          </p>
          <Button onClick={() => navigate(ROUTES.DASHBOARD, { replace: true })}>
            Ugrás az áttekintőre
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Meghívó elfogadása" subtitle={orgName}>
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">
          Meghívtak a <strong>{orgName}</strong> szervezetbe.
        </p>
        {!firebaseUser ? (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            A meghívó elfogadásához be kell jelentkezned vagy regisztrálnod kell.
          </p>
        ) : null}
        <Button className="w-full" onClick={handleAccept}>
          {firebaseUser ? 'Meghívó elfogadása' : 'Bejelentkezés és elfogadás'}
        </Button>
        <Link
          to={ROUTES.LOGIN}
          className="block text-sm text-gray-500 hover:text-gray-700"
        >
          Mégsem
        </Link>
      </div>
    </AuthShell>
  )
}
