import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  BarChart3,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react"

import type { UserRole } from "@/types"
import { cn } from "@/lib/utils"

// =============================================================================
// OWNER NAVIGATION - Collapsible sections
// =============================================================================

interface OwnerNavItem {
  title: string
  url: string
  icon: React.ElementType
}

interface OwnerNavSection {
  label: string
  icon: React.ElementType
  items: OwnerNavItem[]
  defaultOpen?: boolean
}

const ownerNavSections: OwnerNavSection[] = [
  {
    label: "Core",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { title: "Executive Dashboard", url: "/owner/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Finance",
    icon: DollarSign,
    items: [
      { title: "Summary", url: "/finance/summary", icon: DollarSign },
      { title: "P&L Support", url: "/finance/pl", icon: TrendingUp },
    ],
  },
  {
    label: "Team",
    icon: Users,
    items: [
      { title: "Team Overview", url: "/owner/team-directory", icon: Users },
      { title: "Schedule", url: "/manager/schedule", icon: Calendar },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { title: "Dashboard", url: "/marketing/dashboard", icon: BarChart3 },
      { title: "Calendar", url: "/marketing/content-calendar", icon: Calendar },
    ],
  },
  {
    label: "Common Hub",
    icon: FolderOpen,
    items: [
      { title: "Resources", url: "/resources", icon: FolderOpen },
      { title: "Announcements", url: "/announcements", icon: Megaphone },
      { title: "Chat", url: "/chat", icon: MessageSquare },
    ],
  },
]

// =============================================================================
// MANAGER & STAFF NAVIGATION - Flat sections (simpler)
// =============================================================================

interface NavItem {
  title: string
  url: string
  icon: React.ElementType
  roles: UserRole[]
}

interface NavGroup {
  label: string
  roles: UserRole[]
  items: NavItem[]
}

const managerStaffNavGroups: NavGroup[] = [
  {
    label: "Core",
    roles: ["manager", "staff"],
    items: [
      { title: "Dashboard", url: "/manager/dashboard", icon: LayoutDashboard, roles: ["manager"] },
      { title: "Dashboard", url: "/staff/dashboard", icon: LayoutDashboard, roles: ["staff"] },
      { title: "My Tasks", url: "/tasks", icon: CheckSquare, roles: ["manager", "staff"] },
      { title: "Daily Checklist", url: "/weekly-focus", icon: Clock, roles: ["manager"] },
    ],
  },
  {
    label: "Schedule",
    roles: ["manager", "staff"],
    items: [
      { title: "Schedule", url: "/calendar", icon: Calendar, roles: ["manager"] },
      { title: "My Shifts", url: "/my-shifts", icon: Calendar, roles: ["staff"] },
      { title: "Announcements", url: "/announcements", icon: Megaphone, roles: ["manager", "staff"] },
      { title: "Resources", url: "/resources", icon: FolderOpen, roles: ["manager", "staff"] },
    ],
  },
  {
    label: "Management",
    roles: ["manager"],
    items: [
      { title: "Task Delegation", url: "/owner/tasks", icon: CheckSquare, roles: ["manager"] },
      { title: "Schedule Builder", url: "/manager/schedule", icon: Calendar, roles: ["manager"] },
      { title: "Leave Approval", url: "/manager/leave", icon: UserCog, roles: ["manager"] },
      { title: "Post Announcement", url: "/manager/announcements", icon: Megaphone, roles: ["manager"] },
    ],
  },
  {
    label: "Team",
    roles: ["manager"],
    items: [
      { title: "Team Directory", url: "/owner/team-directory", icon: Users, roles: ["manager"] },
      { title: "Attendance", url: "/manager/attendance", icon: Clock, roles: ["manager"] },
    ],
  },
]

function filterNavForRole(groups: NavGroup[], role: UserRole): NavGroup[] {
  return groups
    .filter((g) => g.roles.includes(role))
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0)
}

// =============================================================================
// COLLAPSIBLE NAV SECTION COMPONENT (for Owner)
// =============================================================================

function CollapsibleNavSection({
  section,
  isActive,
}: {
  section: OwnerNavSection
  isActive: (url: string) => boolean
}) {
  const [open, setOpen] = useState(section.defaultOpen ?? false)

  // Check if any item in this section is active
  const hasActiveItem = section.items.some((item) => isActive(item.url))

  return (
    <Collapsible open={open || hasActiveItem} onOpenChange={setOpen}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={cn(
              "flex w-full cursor-pointer items-center justify-between px-2 py-1.5 text-xs font-medium uppercase tracking-wider",
              "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-md transition-colors",
              (open || hasActiveItem) && "text-sidebar-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <section.icon className="h-4 w-4" />
              {section.label}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                (open || hasActiveItem) && "rotate-180"
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="mt-1">
              {section.items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={cn(
                      "hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent",
                      "data-[active=true]:text-amber-600 data-[active=true]:font-medium"
                    )}
                  >
                    <a href={item.url} className="flex items-center gap-[5px]">
                      <item.icon className="h-4 w-4" />
                      <span className="font-serif text-xs font-medium">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

// =============================================================================
// MAIN SIDEBAR COMPONENT
// =============================================================================

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const profile = useAuthStore((s) => s.profile)
  const viewAs = useAuthStore((s) => s.viewAs)
  const signOut = useAuthStore((s) => s.signOut)

  const effectiveRole = (viewAs?.role || profile?.role || "staff") as UserRole

  const isActive = (url: string) =>
    location.pathname === url || location.pathname.startsWith(url + "/")

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  // Get filtered nav for manager/staff
  const filteredNav = filterNavForRole(managerStaffNavGroups, effectiveRole)

  return (
    <Sidebar variant="inset" collapsible="icon" className="border-r border-sidebar-border">
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-sidebar-accent">
              <a href="/" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500">
                  <span className="text-lg font-bold text-black">R</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sidebar-foreground">The Roof</span>
                  <span className="text-xs text-sidebar-foreground/60">Workspace</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="bg-sidebar-border/60" />

      {/* Navigation Content */}
      <SidebarContent className="px-2">
        {effectiveRole === "owner" ? (
          // OWNER: Collapsible sections
          <>
            {ownerNavSections.map((section) => (
              <CollapsibleNavSection
                key={section.label}
                section={section}
                isActive={isActive}
              />
            ))}
          </>
        ) : (
          // MANAGER & STAFF: Flat sections
          <>
            {filteredNav.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          tooltip={item.title}
                          className={cn(
                            "hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent",
                            "data-[active=true]:text-amber-600 data-[active=true]:font-medium"
                          )}
                        >
                          <a href={item.url} className="flex items-center gap-[5px]">
                            <item.icon className="h-4 w-4" />
                            <span className="font-serif text-xs font-medium">{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </>
        )}
      </SidebarContent>

      {/* Footer with User Menu */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatarUrl} alt={profile?.fullName} />
                    <AvatarFallback className="bg-amber-500 text-black">
                      {getInitials(profile?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col text-left text-sm leading-tight">
                    <span className="truncate font-medium text-sidebar-foreground">
                      {profile?.fullName || "User"}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {profile?.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 text-sidebar-foreground/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" side="top" sideOffset={8}>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.fullName}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                    <Badge variant="outline" className="mt-1 w-fit capitalize">
                      {viewAs?.role || profile?.role}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserCog className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
