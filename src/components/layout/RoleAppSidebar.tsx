import * as React from "react"
import {
  Activity,
  Building2,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileText,
  LifeBuoy,
  MessageSquare,
  Network,
  Shield,
  Spline,
  Target,
  Ticket,
  Users,
  UserRound,
  Wrench,
} from "lucide-react"

import { useAuthStore } from "@/stores/authStore"
import type { ManagerType, UserRole } from "@/types"
import {
  AppSidebar,
  SidebarNavGroup,
  SidebarNavLink,
  SidebarSection,
} from "@/components/ui"

type RoleNav = Array<{
  title: string
  collapsible?: boolean
  defaultOpen?: boolean
  items: React.ReactNode[]
}>

function getRoleLabel(role: UserRole, managerType?: ManagerType | null) {
  if (role === "owner") return "Owner"
  if (role === "manager") {
    const labels: Record<string, string> = {
      bar: "Bar Manager",
      floor: "Floor Manager",
      marketing: "Marketing Manager",
    }
    return managerType ? labels[managerType] || "Manager" : "Manager"
  }
  return "Staff"
}

function buildOwnerNav(): RoleNav {
  return [
    {
      title: "Executive Dashboard",
      collapsible: true,
      defaultOpen: true,
      items: [
        <SidebarNavLink key="live" label="Live Snapshot" href="/" icon={Activity} />,
        <SidebarNavLink key="exec" label="Executive Dashboard" href="/owner/executive" icon={Target} />,
        <SidebarNavLink key="mydash" label="My Dashboard" href="/my-dashboard" icon={Target} />,
        <SidebarNavLink key="weekly" label="Weekly Focus" href="/weekly-focus" icon={Ticket} />,
        <SidebarNavLink key="alerts" label="Alerts" href="/alerts" icon={Wrench} />,
      ],
    },
    {
      title: "Financial Suite",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="fin-sum" label="Financial Summary" href="/finance/summary" icon={DollarSign} />,
        <SidebarNavLink key="pl" label="Detailed P&L" href="/finance/pl" icon={FileText} />,
        <SidebarNavGroup
          key="fin-more"
          label="More Financials"
          icon={Spline}
          defaultOpen={false}
          children={[
            { label: "Report Builder", href: "/finance/reports" },
            { label: "Category Drill-down", href: "/finance/category" },
            { label: "Cash Flow", href: "/finance/cashflow" },
            { label: "Cost Control", href: "/finance/costs" },
            { label: "Forecast", href: "/finance/forecast" },
          ]}
        />,
      ],
    },
    {
      title: "Human Capital",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="org" label="Org Chart" href="/owner/org-chart" icon={Network} />,
        <SidebarNavLink key="team" label="Team Directory" href="/owner/team" icon={Users} />,
        <SidebarNavLink key="delegation" label="To-Do / Delegation" href="/owner/tasks" icon={ClipboardList} />,
        <SidebarNavLink key="workforce" label="Workforce Overview" href="/ops/workforce" icon={UserRound} />,
      ],
    },
    {
      title: "System Settings",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="perm" label="Permissions" href="/settings/permissions" icon={Shield} />,
        <SidebarNavLink key="roles" label="Roles" href="/settings/roles" icon={Users} />,
        <SidebarNavLink key="sops" label="SOP Management" href="/settings/sops" icon={FileText} />,
        <SidebarNavLink key="sync" label="Data Sync" href="/admin/sync" icon={Wrench} />,
      ],
    },
    {
      title: "Company Hub",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="ann" label="Announcements" href="/announcements" icon={MessageSquare} />,
        <SidebarNavLink key="chat" label="Messaging" href="/chat" icon={MessageSquare} />,
        <SidebarNavLink key="res" label="Resource Library" href="/resources" icon={FileText} />,
        <SidebarNavLink key="cal" label="Event Calendar" href="/calendar" icon={CalendarDays} />,
        <SidebarNavLink key="kb" label="Knowledge Base" href="/kb" icon={Building2} />,
      ],
    },
  ]
}

function buildManagerNav(): RoleNav {
  return [
    {
      title: "Operational Dashboard",
      collapsible: true,
      defaultOpen: true,
      items: [
        <SidebarNavLink key="mgrdash" label="Overview" href="/manager/dashboard" icon={Activity} />,
        <SidebarNavLink key="lates" label="Alerts (Who is late?)" href="/alerts" icon={Wrench} />,
        <SidebarNavLink key="shift" label="Shift Summary" href="/manager/shift-summary" icon={ClipboardList} />,
      ],
    },
    {
      title: "Promotions & Events",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="promos" label="Promotions" href="/manager/promotions" icon={Ticket} />,
        <SidebarNavLink key="events" label="Events" href="/manager/events" icon={CalendarDays} />,
        <SidebarNavLink key="reservations" label="Reservations" href="/manager/reservations" icon={CalendarDays} />,
      ],
    },
    {
      title: "Schedule Builder",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="schedule" label="Schedule Builder" href="/manager/schedule" icon={CalendarDays} />,
        <SidebarNavLink key="staffing" label="Team Schedule" href="/ops/staffing" icon={Users} />,
        <SidebarNavLink key="teamstatus" label="Team Status" href="/ops/workforce" icon={Users} />,
      ],
    },
    {
      title: "People Management",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="leave" label="Leave / PTO Approval" href="/manager/leave" icon={ClipboardList} />,
        <SidebarNavLink key="incidents" label="Incident Reporting" href="/manager/incidents" icon={Wrench} />,
        <SidebarNavLink key="onboarding" label="Onboarding / Offboarding" href="/manager/onboarding" icon={Users} />,
        <SidebarNavLink key="checklists" label="Checklist Oversight" href="/tasks" icon={ClipboardList} />,
      ],
    },
    {
      title: "Company Hub",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="ann" label="Announcements" href="/announcements" icon={MessageSquare} />,
        <SidebarNavLink key="chat" label="Messaging" href="/chat" icon={MessageSquare} />,
        <SidebarNavLink key="res" label="Resource Library" href="/resources" icon={FileText} />,
        <SidebarNavLink key="cal" label="Event Calendar" href="/calendar" icon={CalendarDays} />,
        <SidebarNavLink key="kb" label="Knowledge Base" href="/kb" icon={Building2} />,
      ],
    },
  ]
}

function buildStaffNav(): RoleNav {
  return [
    {
      title: "Personal Workspace",
      collapsible: true,
      defaultOpen: true,
      items: [
        <SidebarNavLink key="dash" label="My Dashboard" href="/staff/dashboard" icon={Activity} />,
        <SidebarNavLink key="shifts" label="Shift View" href="/my-shifts" icon={CalendarDays} />,
        <SidebarNavLink key="tasks" label="Task List" href="/tasks" icon={ClipboardList} />,
        <SidebarNavLink key="today" label="Today’s Schedule" href="/calendar" icon={CalendarDays} />,
      ],
    },
    {
      title: "Self-Service",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="leave" label="Request Leave / Time Off" href="/leave" icon={ClipboardList} />,
        <SidebarNavLink key="payslips" label="Payslips" href="/staff/payslips" icon={FileText} />,
        <SidebarNavLink key="profile" label="My Profile" href="/profile" icon={UserRound} />,
      ],
    },
    {
      title: "Company Hub",
      collapsible: true,
      defaultOpen: false,
      items: [
        <SidebarNavLink key="ann" label="Announcements" href="/announcements" icon={MessageSquare} />,
        <SidebarNavLink key="chat" label="Messaging" href="/chat" icon={MessageSquare} />,
        <SidebarNavLink key="res" label="Resource Library" href="/resources" icon={FileText} />,
        <SidebarNavLink key="cal" label="Event Calendar" href="/calendar" icon={CalendarDays} />,
        <SidebarNavLink key="kb" label="Knowledge Base" href="/kb" icon={Building2} />,
      ],
    },
  ]
}

export function RoleAppSidebar({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const profile = useAuthStore((s) => s.profile)
  const viewAs = useAuthStore((s) => s.viewAs)

  const effectiveRole = (viewAs?.role || profile?.role || "staff") as UserRole
  const effectiveManagerType = (viewAs?.managerType ?? profile?.managerType) as ManagerType | undefined

  const nav =
    effectiveRole === "owner"
      ? buildOwnerNav()
      : effectiveRole === "manager"
        ? buildManagerNav()
        : buildStaffNav()

  const userLabel = profile
    ? {
        name: profile.fullName,
        email: profile.email,
        role: getRoleLabel(effectiveRole, effectiveManagerType ?? null),
        avatar: profile.avatarUrl,
      }
    : undefined

  return (
    <AppSidebar
      className={className}
      logo={
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            R
          </div>
          <span className="font-serif font-semibold">The Roof</span>
        </div>
      }
      user={userLabel}
      footerItems={[
        {
          label: "Help",
          href: "/kb",
          icon: LifeBuoy,
          onClick: onNavigate,
        },
      ]}
    >
      {nav.map((section) => (
        <SidebarSection
          key={section.title}
          title={section.title}
          collapsible={section.collapsible}
          defaultOpen={section.defaultOpen}
        >
          <div onClick={onNavigate}>{section.items}</div>
        </SidebarSection>
      ))}
    </AppSidebar>
  )
}

