import { useNavigate } from "react-router-dom"
import { ChevronRight, FileText, RefreshCw, Shield, Users } from "lucide-react"

import { PageHeader } from "@/components/ui"

const settingsItems = [
  {
    title: "Permissions",
    description: "Manage user permissions and access levels",
    icon: Shield,
    href: "/settings/permissions",
  },
  {
    title: "Roles",
    description: "Configure roles and their capabilities",
    icon: Users,
    href: "/settings/roles",
  },
  {
    title: "SOP Management",
    description: "Manage standard operating procedures",
    icon: FileText,
    href: "/settings/sops",
  },
  {
    title: "Data Sync",
    description: "Configure data synchronization settings",
    icon: RefreshCw,
    href: "/admin/sync",
  },
]

export default function Settings() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage system settings and configurations" />

      <div className="grid gap-4 md:grid-cols-2">
        {settingsItems.map((item) => (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className="flex items-center gap-4 rounded-card border border-border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <item.icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  )
}

