import { useState } from 'react'
import { IndianRupee, Ruler } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { RadioGroup } from '@/components/ui/Radio'
import { Select } from '@/components/ui/Select'
import { SidePanel } from '@/components/ui/SidePanel'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'
import type { CulturalPreference } from '@/types/project'
import type { Plot } from '@/types/design'
import { FormField } from './FormField'

const SPECIAL_ROOMS = ['Pooja / prayer room', 'Home office', 'Servant quarters', 'Store room']

const CULTURAL_OPTIONS: { label: string; value: CulturalPreference; description: string; disabled?: boolean }[] = [
  { label: 'Hindu — Vastu Shastra', value: 'hindu', description: 'Brahmasthan, NE pooja room, entrance rules' },
  { label: 'Neutral / Secular', value: 'neutral', description: 'Optimised for space, light and cost only' },
  { label: 'Muslim — Qibla-aligned', value: 'muslim', description: 'Coming in a future release', disabled: true },
]

const initialFormState = {
  name: '',
  plotWidth: '30',
  plotHeight: '40',
  facing: 'north' as Plot['facing'],
  budget: '4500000',
  turnkey: false,
  checkedRooms: [] as string[],
  culturalPreference: 'hindu' as CulturalPreference,
  notes: '',
}

export function NewProjectPanel() {
  const open = useProjectsStore((state) => state.newProjectPanelOpen)
  const closePanel = useProjectsStore((state) => state.closeNewProjectPanel)
  const createProject = useProjectsStore((state) => state.createProject)
  const navigate = useNavigate()

  const [form, setForm] = useState(initialFormState)
  const [error, setError] = useState<string | null>(null)

  function toggleRoom(room: string) {
    setForm((prev) => ({
      ...prev,
      checkedRooms: prev.checkedRooms.includes(room)
        ? prev.checkedRooms.filter((r) => r !== room)
        : [...prev.checkedRooms, room],
    }))
  }

  function handleClose() {
    setForm(initialFormState)
    setError(null)
    closePanel()
  }

  function handleCreate() {
    const width = Number(form.plotWidth)
    const height = Number(form.plotHeight)
    const budget = Number(form.budget)

    if (!form.name.trim()) return setError('Give your project a name to continue.')
    if (!width || width <= 0 || !height || height <= 0) return setError('Enter valid plot dimensions.')
    if (!budget || budget <= 0) return setError('Enter a budget amount.')

    const project = createProject({
      name: form.name.trim(),
      plotWidth: width,
      plotHeight: height,
      facing: form.facing,
      budget,
      turnkey: form.turnkey,
      culturalPreference: form.culturalPreference,
      specialRooms: form.checkedRooms,
      notes: form.notes.trim() || undefined,
    })

    setForm(initialFormState)
    setError(null)
    closePanel()
    navigate(`/projects/${project.id}`)
    toast.success(`${project.name} created — opening workspace`)
  }

  return (
    <SidePanel
      open={open}
      onClose={handleClose}
      title="New project"
      description="Tell us about the plot and household — this feeds the layout generator."
      defaultWidth={440}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create project</Button>
        </div>
      }
    >
      <Alert open={!!error} onClose={() => setError(null)} variant="danger" title="Check the form">
        {error}
      </Alert>

      <div className="flex flex-col gap-5 px-5 py-4">
        <FormField label="Project name" required>
          <Input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Sharma Residence"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Plot width" required hint="in feet">
            <Input
              type="number"
              min={0}
              leftSlot={<Ruler />}
              value={form.plotWidth}
              onChange={(event) => setForm((prev) => ({ ...prev, plotWidth: event.target.value }))}
            />
          </FormField>
          <FormField label="Plot length" required hint="in feet">
            <Input
              type="number"
              min={0}
              leftSlot={<Ruler />}
              value={form.plotHeight}
              onChange={(event) => setForm((prev) => ({ ...prev, plotHeight: event.target.value }))}
            />
          </FormField>
        </div>

        <FormField label="Facing direction" required>
          <Select
            value={form.facing}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, facing: event.target.value as Plot['facing'] }))
            }
          >
            <option value="north">North</option>
            <option value="south">South</option>
            <option value="east">East</option>
            <option value="west">West</option>
          </Select>
        </FormField>

        <FormField label="Total budget" required hint="Construction-only, in ₹">
          <Input
            type="number"
            min={0}
            leftSlot={<IndianRupee />}
            value={form.budget}
            onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))}
          />
        </FormField>

        <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-text">Turnkey budget</p>
            <p className="text-xs text-text-muted">Includes interiors and finishing</p>
          </div>
          <Switch
            checked={form.turnkey}
            onChange={(event) => setForm((prev) => ({ ...prev, turnkey: event.target.checked }))}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-text">Special-purpose rooms</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SPECIAL_ROOMS.map((room) => (
              <label key={room} className="flex items-center gap-2.5 text-sm text-text">
                <Checkbox checked={form.checkedRooms.includes(room)} onChange={() => toggleRoom(room)} />
                {room}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-text">Cultural / religious preference</p>
          <RadioGroup
            name="cultural-preference"
            value={form.culturalPreference}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, culturalPreference: value as CulturalPreference }))
            }
            options={CULTURAL_OPTIONS}
          />
        </div>

        <FormField label="Notes for the design team" hint="Optional">
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="e.g. Elderly parents will need a ground-floor bedroom."
          />
        </FormField>
      </div>
    </SidePanel>
  )
}
