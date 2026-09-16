import { type ComponentType, useState } from 'react'
import { Boxes, Calendar, CreditCard, HardDrive, Mail, MessageCircle } from 'lucide-react'
import { Container } from '@/components/layout/Container'
import { Navbar } from '@/components/layout/Navbar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter } from '@/components/ui/Card'
import { toast } from '@/stores/useToastStore'

interface Integration {
  id: string
  name: string
  description: string
  icon: ComponentType<{ className?: string }>
  connected: boolean
}

const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'aps',
    name: 'Autodesk Platform Services',
    description: 'Export designs directly to AutoCAD, Revit and other BIM tools.',
    icon: Boxes,
    connected: true,
  },
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'Save exported floor plans, BOQs and renders straight to Drive.',
    icon: HardDrive,
    connected: false,
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Schedule architect review calls from inside a project.',
    icon: Calendar,
    connected: false,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Send design updates and BOQ summaries to clients.',
    icon: MessageCircle,
    connected: false,
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    description: 'Collect payment for architect review and premium exports.',
    icon: CreditCard,
    connected: false,
  },
  {
    id: 'email',
    name: 'Email (SMTP)',
    description: 'Email exported PDFs and BOQs directly to clients.',
    icon: Mail,
    connected: true,
  },
]

export function Settings() {
  const [integrations, setIntegrations] = useState(INITIAL_INTEGRATIONS)

  function toggleConnection(id: string) {
    const integration = integrations.find((item) => item.id === id)
    if (!integration) return
    const nextConnected = !integration.connected

    setIntegrations((prev) => prev.map((item) => (item.id === id ? { ...item, connected: nextConnected } : item)))
    toast[nextConnected ? 'success' : 'info'](
      `${integration.name} ${nextConnected ? 'connected' : 'disconnected'}`,
    )
  }

  return (
    <div className="min-h-svh bg-bg">
      <Navbar />
      <Container className="py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-text-muted">Manage integrations with the tools your team already uses.</p>
        </div>

        <h2 className="mb-3 font-display text-sm font-semibold text-text">Integrations</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {integrations.map((integration) => {
            const Icon = integration.icon
            return (
              <Card key={integration.id} className="flex flex-col">
                <CardBody className="flex flex-1 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-text">{integration.name}</p>
                      {integration.connected && <Badge variant="success">Connected</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-text-muted">{integration.description}</p>
                  </div>
                </CardBody>
                <CardFooter>
                  <Button
                    variant={integration.connected ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() => toggleConnection(integration.id)}
                  >
                    {integration.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </Container>
    </div>
  )
}
