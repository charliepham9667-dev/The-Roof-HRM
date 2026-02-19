import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  StatusBadge,
  Separator,
  Skeleton,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  StatCard,
  WidgetCard,
  ActivityList,
  ProgressRing,
  PageHeader,
  // StatusBadge already imported above
  AppSidebar,
  SidebarSection,
  SidebarNavLink,
  SidebarNavGroup,
} from "@/components/ui"
import { useTheme } from "@/components/theme-provider"
import { 
  MoreHorizontal, 
  User, 
  Settings, 
  LogOut, 
  CheckCircle, 
  Activity,
  Home,
  CheckSquare,
  Calendar as CalendarIcon,
  BarChart3,
  FolderOpen,
  Users,
  HelpCircle,
} from "lucide-react"

export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-bold text-foreground">
            The Roof Design System
          </h1>
          <p className="text-muted-foreground">
            Brand-aligned components built with shadcn/ui patterns
          </p>
          <div className="flex gap-2 pt-4">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("system")}
            >
              System
            </Button>
          </div>
        </div>

        {/* Component Overview */}
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Component Library</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} • Built with shadcn/ui + Custom Components
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-3xl font-bold text-foreground">25+</p>
                <p className="text-sm text-muted-foreground">Total Components</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-3xl font-bold text-foreground">7</p>
                <p className="text-sm text-muted-foreground">Custom Components</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-3xl font-bold text-foreground">2</p>
                <p className="text-sm text-muted-foreground">Theme Modes</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-3xl font-bold text-foreground">10</p>
                <p className="text-sm text-muted-foreground">Brand Colors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Separator />

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Brand</Button>
            <Button variant="secondary">Soft</Button>
            <Button variant="outline">Soft Primary</Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="lg">Extra Large</Button>
          </div>
        </section>

        <Separator />

        {/* Badges */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Badges</h2>
          <div className="flex flex-wrap gap-4">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
          <div className="flex flex-wrap gap-4">
            <StatusBadge variant="success">Success</StatusBadge>
            <StatusBadge variant="warning">Warning</StatusBadge>
            <StatusBadge variant="error">Error</StatusBadge>
            <StatusBadge variant="info">Info</StatusBadge>
          </div>
          <div className="flex flex-wrap gap-4">
            <Badge variant="secondary">Brand</Badge>
            <Badge variant="outline">Subtle</Badge>
          </div>
        </section>

        <Separator />

        {/* Inputs */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Form Inputs</h2>
          <div className="grid max-w-sm gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="charlie@theroof.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disabled">Disabled</Label>
              <Input id="disabled" disabled placeholder="Disabled input" />
            </div>
          </div>
        </section>

        <Separator />

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Cards</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
                <CardDescription>January 2025</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">₫1.2B</p>
                <p className="text-sm text-success">+12% from last month</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">View Details</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Staff on Shift</CardTitle>
                <CardDescription>Currently working</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src="/placeholder-avatar.jpg" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>TN</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>PH</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">+5 more</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Skeleton */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Loading States</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
            <Skeleton className="h-[125px] w-full rounded-lg" />
          </div>
        </section>

        <Separator />

        {/* Dialog */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Dialog / Modal</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Shift</DialogTitle>
                <DialogDescription>
                  Make changes to the shift schedule. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="staff">Staff Member</Label>
                  <Input id="staff" defaultValue="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Shift Time</Label>
                  <Input id="time" defaultValue="14:00 - 22:00" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>

        <Separator />

        {/* Dropdown Menu */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Dropdown Menu</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        <Separator />

        {/* Select */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Select</h2>
          <div className="max-w-xs">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <Separator />

        {/* Tabs */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Tabs</h2>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                  <CardDescription>Key metrics at a glance</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Your overview content goes here.</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="analytics">
              <Card>
                <CardHeader>
                  <CardTitle>Analytics</CardTitle>
                  <CardDescription>Detailed performance data</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Your analytics content goes here.</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle>Reports</CardTitle>
                  <CardDescription>Generated reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Your reports content goes here.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* Tooltip */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Tooltip</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a helpful tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </section>

        <Separator />

        {/* Table */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Table</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Shifts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">John Doe</TableCell>
                    <TableCell>Manager</TableCell>
                    <TableCell><StatusBadge variant="success">Active</StatusBadge></TableCell>
                    <TableCell className="text-right">24</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Tiny Nguyen</TableCell>
                    <TableCell>Floor Manager</TableCell>
                    <TableCell><StatusBadge variant="success">Active</StatusBadge></TableCell>
                    <TableCell className="text-right">22</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Phu Tran</TableCell>
                    <TableCell>Head Bartender</TableCell>
                    <TableCell><StatusBadge variant="warning">On Leave</StatusBadge></TableCell>
                    <TableCell className="text-right">18</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Color Palette Reference */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Brand Colors</h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2 text-center">
              <div className="h-16 w-full rounded-lg bg-brand-burgundy" />
              <p className="text-xs">Burgundy</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="h-16 w-full rounded-lg bg-brand-terracotta" />
              <p className="text-xs">Terracotta</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="h-16 w-full rounded-lg bg-brand-coral" />
              <p className="text-xs">Coral</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="h-16 w-full rounded-lg bg-brand-peach" />
              <p className="text-xs">Peach</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="h-16 w-full rounded-lg bg-brand-sand" />
              <p className="text-xs">Sand</p>
            </div>
          </div>
        </section>

        {/* Page Header */}
        <Separator />
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Page Header</h2>
          <div className="rounded-card border border-border bg-background p-6 shadow-card">
            <PageHeader
              title="My Tasks"
              description="Short description will be placed here"
              actions={
                <>
                  <Button variant="outline">Share Tasks</Button>
                  <Button>+ New Task</Button>
                </>
              }
            />
          </div>
        </section>

        {/* Stat Cards */}
        <Separator />
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Stat Cards</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Created"
              value={23}
              trend={28}
              subtitle="in the last 7 days"
              menuItems={[{ label: "View details", onClick: () => {} }]}
            />
            <StatCard
              label="Updated"
              value={17}
              trend={20}
              subtitle="in the last 7 days"
            />
            <StatCard
              label="Due Soon"
              value="08"
              trend={10}
              subtitle="in the last 7 days"
            />
            <StatCard
              label="Completed"
              value={36}
              trend={42}
              subtitle="in the last 7 days"
            />
          </div>
        </section>

        {/* Widget Card */}
        <Separator />
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Widget Card</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <WidgetCard
              title="Recent Activity"
              icon={Activity}
              menuItems={[
                { label: "Refresh", onClick: () => {} },
                { label: "Settings", onClick: () => {} },
              ]}
            >
              <ActivityList
                items={[
                  { id: "1", title: "Juyed Ahmed's List", subtitle: "In Project 11", color: "coral" },
                  { id: "2", title: "Pixem's Project", subtitle: "Updated 2h ago", color: "purple" },
                  { id: "3", title: "MatexAI Meeting", subtitle: "In Project 11", color: "success" },
                ]}
              />
            </WidgetCard>

            <WidgetCard
              title="Status Overview"
              icon={CheckCircle}
            >
              <div className="flex items-center justify-around py-4">
                <div className="text-center">
                  <ProgressRing value={60} color="error" size="sm" />
                  <p className="mt-2 text-sm text-muted-foreground">To Do</p>
                </div>
                <div className="text-center">
                  <ProgressRing value={30} color="warning" size="sm" />
                  <p className="mt-2 text-sm text-muted-foreground">In Progress</p>
                </div>
                <div className="text-center">
                  <ProgressRing value={40} color="success" size="sm" />
                  <p className="mt-2 text-sm text-muted-foreground">Done</p>
                </div>
              </div>
            </WidgetCard>
          </div>
        </section>

        {/* Status Badges */}
        <Separator />
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Status Badges</h2>
          <div className="flex flex-wrap gap-3">
            <StatusBadge variant="success" showIcon>Completed</StatusBadge>
            <StatusBadge variant="warning" showIcon>Pending</StatusBadge>
            <StatusBadge variant="error" showIcon>Overdue</StatusBadge>
            <StatusBadge variant="info" showIcon>In Review</StatusBadge>
            <StatusBadge variant="high" showIcon>High Priority</StatusBadge>
            <StatusBadge variant="medium" showIcon>Medium Priority</StatusBadge>
            <StatusBadge variant="low" showIcon>Low Priority</StatusBadge>
          </div>
        </section>

        {/* Progress Rings */}
        <Separator />
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Progress Rings</h2>
          <div className="flex flex-wrap items-end gap-8">
            <div className="text-center">
              <ProgressRing value={75} size="sm" color="success" />
              <p className="mt-2 text-sm text-muted-foreground">Small</p>
            </div>
            <div className="text-center">
              <ProgressRing value={60} size="md" color="warning" />
              <p className="mt-2 text-sm text-muted-foreground">Medium</p>
            </div>
            <div className="text-center">
              <ProgressRing value={45} size="lg" color="error" />
              <p className="mt-2 text-sm text-muted-foreground">Large</p>
            </div>
            <div className="text-center">
              <ProgressRing value={82} size="xl" color="info">
                <div className="text-center">
                  <span className="text-2xl font-bold">82%</span>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
              </ProgressRing>
              <p className="mt-2 text-sm text-muted-foreground">Custom Content</p>
            </div>
          </div>
        </section>

        {/* Sidebar Preview */}
        <Separator />
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Sidebar</h2>
          <p className="text-muted-foreground">
            Navigation sidebar with sections, links, indicators, and user info.
          </p>
          <div className="flex h-[500px] overflow-hidden rounded-card border border-border shadow-card">
            <AppSidebar
              logo={
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                    R
                  </div>
                  <span className="font-serif font-semibold">The Roof</span>
                </div>
              }
              user={{
                name: "Charlie Pham",
                role: "Owner",
              }}
              footerItems={[
                { label: "Settings", href: "#", icon: Settings },
                { label: "Help & Support", href: "#", icon: HelpCircle },
              ]}
            >
              <SidebarSection>
                <SidebarNavLink label="Dashboard" href="#" icon={Home} />
                <SidebarNavLink label="My Tasks" href="/design-system" icon={CheckSquare} />
                <SidebarNavLink label="Calendar" href="#" icon={CalendarIcon} />
                <SidebarNavLink label="Reports" href="#" icon={BarChart3} />
              </SidebarSection>

              <SidebarSection title="Projects" collapsible showAddButton defaultOpen>
                <SidebarNavLink label="Marketing Campaign" href="#" indicator="coral" />
                <SidebarNavLink label="Website Redesign" href="#" indicator="success" />
                <SidebarNavLink label="Mobile App" href="#" indicator="purple" />
              </SidebarSection>

              <SidebarSection title="Team" collapsible showAddButton defaultOpen>
                <SidebarNavLink label="All Staff" href="#" icon={Users} />
                <SidebarNavGroup 
                  label="Departments" 
                  icon={FolderOpen}
                  defaultOpen
                  children={[
                    { label: "Bar Team", href: "#" },
                    { label: "Floor Staff", href: "#" },
                    { label: "Kitchen", href: "#" },
                  ]}
                />
              </SidebarSection>
            </AppSidebar>
            
            <div className="flex-1 bg-background p-6">
              <p className="text-muted-foreground">Main content area preview</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
