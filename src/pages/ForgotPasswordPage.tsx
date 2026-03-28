import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AuthShell } from './LoginPage'
import { sendPasswordReset } from '@/services/auth.service'
import { ROUTES } from '@/config/constants'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch {
      setError('Nem sikerült elküldeni a visszaállítási emailt.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell title="Email elküldve" subtitle="Ellenőrizd a postaládád">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="text-sm text-gray-600">
            Küldtünk egy jelszó-visszaállítási linket a{' '}
            <strong>{email}</strong> címre.
          </p>
          <Link
            to={ROUTES.LOGIN}
            className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Vissza a bejelentkezéshez
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Jelszó visszaállítása" subtitle="Add meg az email címed">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email cím"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="h-4 w-4" />}
          placeholder="nev@webtown.hu"
          required
          autoComplete="email"
        />
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Visszaállítási email küldése
        </Button>
      </form>
      <Link
        to={ROUTES.LOGIN}
        className="mt-5 flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Vissza a bejelentkezéshez
      </Link>
    </AuthShell>
  )
}
