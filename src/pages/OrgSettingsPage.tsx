import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOrgStore } from '@/stores/orgStore'
import { updateOrganization } from '@/services/organization.service'
import type { Organization } from '@/types/models'

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-3 border-b border-gray-100 last:border-0">
      <div className="mt-0.5 flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-gray-200'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </button>
    </label>
  )
}

export function OrgSettingsPage() {
  const { currentOrg } = useOrgStore()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const [defaultEstimateType, setDefaultEstimateType] = useState<Organization['settings']['defaultEstimateType']>('points')
  const [clientCommenting, setClientCommenting] = useState(false)
  const [estimateRequired, setEstimateRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!currentOrg) return
    setName(currentOrg.name)
    setSlug(currentOrg.slug)
    setHoursPerDay(currentOrg.settings.hoursPerDay)
    setDefaultEstimateType(currentOrg.settings.defaultEstimateType)
    setClientCommenting(currentOrg.settings.clientCommentingEnabled)
    setEstimateRequired(currentOrg.settings.estimateRequiredForPlanbox)
  }, [currentOrg?.id])

  const handleSave = async () => {
    if (!currentOrg || !name.trim()) return
    setSaving(true)
    try {
      await updateOrganization(currentOrg.id, {
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        settings: {
          defaultEstimateType,
          hoursPerDay,
          clientCommentingEnabled: clientCommenting,
          estimateRequiredForPlanbox: estimateRequired,
        },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!currentOrg) return null

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Szervezet beállítások</h1>

      {/* Alapadatok */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Alapadatok</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">Szervezet neve</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Szervezet neve" />
          </div>
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">Slug (URL)</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="pelda-szervezet" />
          </div>
        </div>
      </section>

      {/* Becslés */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Becslés beállítások</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">Alapértelmezett becslés típus</label>
            <select
              value={defaultEstimateType}
              onChange={(e) => setDefaultEstimateType(e.target.value as Organization['settings']['defaultEstimateType'])}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-primary-500 focus:outline-none"
            >
              <option value="points">Story Points</option>
              <option value="tshirt">Pólóméret (XS–XL)</option>
              <option value="hours">Óra</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">Munkaóra / nap</label>
            <Input
              type="number"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
              min={1}
              max={24}
            />
          </div>
        </div>
      </section>

      {/* Funkciók */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Funkciók</h2>
        <div className="rounded-xl border border-gray-200 bg-white px-4">
          <ToggleRow
            label="Kliens kommentelés"
            description="Client szerepkörű felhasználók is írhatnak kommentet story-kra."
            checked={clientCommenting}
            onChange={setClientCommenting}
          />
          <ToggleRow
            label="Becslés kötelező a Planbox-hoz"
            description="Story csak becsléssel helyezhető a Planbox-ba."
            checked={estimateRequired}
            onChange={setEstimateRequired}
          />
        </div>
      </section>

      <Button onClick={handleSave} loading={saving} variant={saved ? 'secondary' : 'primary'} className="gap-1.5">
        {saved ? <><Check className="h-4 w-4" /> Mentve</> : 'Mentés'}
      </Button>
    </div>
  )
}
