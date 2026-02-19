# The Roof HRM - Design System

## Overview

A comprehensive design system built on **shadcn/ui** with **The Roof** brand identity. Features a warm cream/light aesthetic with full dark mode support.

**Design Inspiration:** Modern dashboard UIs (Zaply-style) with warm, inviting colors.

---

## Quick Start

```tsx
import { 
  Button, 
  Card, 
  StatCard, 
  WidgetCard,
  PageHeader,
  AppSidebar,
  SidebarSection,
  SidebarNavLink,
} from "@/components/ui"
```

---

## Color System

### Semantic Tokens

| Token | Light Mode | Usage |
|-------|------------|-------|
| `bg-background` | #F9FAFB | Page background |
| `bg-card` | #FFFFFF | Cards, elevated surfaces |
| `bg-muted` | #F5F5F4 | Subtle backgrounds, hover states |
| `text-foreground` | #000000 | Primary text |
| `text-muted-foreground` | #78716C | Secondary text (warm gray) |
| `border-border` | #E7E5E4 | Borders |
| `bg-primary` | #F97316 | Primary actions (orange) |
| `text-primary` | #F97316 | Accent text, links |

---

## Surfaces & Elevation (Light mode)

- **Page surface**: `bg-background` = **#F9FAFB**
- **Card surface**: `bg-card` = **#FFFFFF**
- **Card radius**: **16px** via `rounded-card`
- **Button/control radius**: **8px** via `rounded-control`
- **Card shadow**: `shadow-card` = `0 4px 20px rgba(16, 24, 40, 0.04), 0 2px 4px rgba(16, 24, 40, 0.02)`

### Brand Colors

| Class | Hex | Usage |
|-------|-----|-------|
| `brand-burgundy` | #6C2B29 | Deep accents |
| `brand-terracotta` | #C74C3C | Primary brand |
| `brand-coral` | #F5793B | CTAs, highlights |
| `brand-peach` | #E7C8B1 | Light accents |
| `brand-sand` | #F4E9D3 | Warm backgrounds |
| `brand-linen` | #FAF4EF | Soft backgrounds |
| `brand-espresso` | #4A1F1C | Dark text |

### Status Colors

```tsx
// Success (green)
<div className="text-success">+12%</div>
<div className="bg-success/10 text-success">Completed</div>

// Warning (amber)
<div className="text-warning">Pending</div>
<div className="bg-warning/10 text-warning">Due Soon</div>

// Error (red)
<div className="text-error">-5%</div>
<div className="bg-error/10 text-error">Overdue</div>

// Info (blue)
<div className="text-info">In Progress</div>
<div className="bg-info/10 text-info">Scheduled</div>
```

---

## Typography

| Role | Font | Class |
|------|------|-------|
| Page titles | Playfair Display | `font-serif` |
| Subheadings | Cormorant Garamond | `font-subheading` |
| Body | Inter | `font-sans` (default) |

---

## Components

### Layout

#### PageHeader

```tsx
<PageHeader
  title="My Tasks"
  description="Manage and track your tasks"
  actions={
    <>
      <Button variant="outline">Share</Button>
      <Button>+ New Task</Button>
    </>
  }
/>
```

#### AppSidebar

```tsx
<AppSidebar
  logo={<Logo />}
  user={{ name: "Charlie", role: "Owner" }}
  footerItems={[
    { label: "Settings", href: "/settings", icon: Settings },
  ]}
>
  <SidebarSection>
    <SidebarNavLink label="Dashboard" href="/" icon={Home} />
    <SidebarNavLink label="Tasks" href="/tasks" icon={CheckSquare} />
  </SidebarSection>
  
  <SidebarSection title="Projects" collapsible showAddButton>
    <SidebarNavLink label="Marketing" href="#" indicator="coral" />
    <SidebarNavLink label="Development" href="#" indicator="success" />
  </SidebarSection>
</AppSidebar>
```

**Indicator colors:** `primary`, `success`, `warning`, `error`, `info`, `coral`, `purple`, `cyan`

---

### Data Display

#### StatCard

KPI card with icon, value, trend, and subtitle.

```tsx
<StatCard
  label="Created"
  value={23}
  icon={FileText}
  iconColor="coral"
  trend={28}
  subtitle="In the last 7 days"
  menuItems={[{ label: "View details", onClick: () => {} }]}
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Card title |
| `value` | string \| number | Main metric |
| `icon` | LucideIcon | Icon component |
| `iconColor` | string | "default" \| "primary" \| "success" \| "warning" \| "error" \| "info" \| "coral" \| "terracotta" |
| `trend` | number | Percentage (positive = green, negative = red) |
| `subtitle` | string | Description text |
| `menuItems` | array | Dropdown menu items |

#### WidgetCard

Container for charts, lists, and content.

```tsx
<WidgetCard
  title="Recent Activity"
  icon={Activity}
  menuItems={[{ label: "Refresh", onClick: () => {} }]}
>
  <ActivityList items={[...]} />
</WidgetCard>
```

#### ActivityList

```tsx
<ActivityList
  items={[
    { id: "1", title: "Task created", subtitle: "Project A", color: "success" },
    { id: "2", title: "Comment added", subtitle: "2h ago", color: "info" },
  ]}
/>
```

#### ProgressRing

```tsx
<ProgressRing value={75} size="md" color="success" />

// With custom content
<ProgressRing value={82} size="xl" color="info">
  <div className="text-center">
    <span className="text-2xl font-bold">82%</span>
    <p className="text-xs text-muted-foreground">Complete</p>
  </div>
</ProgressRing>
```

**Sizes:** `sm` (64px), `md` (96px), `lg` (128px), `xl` (160px)

---

### Forms

#### Button

```tsx
// Variants
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="soft">Soft</Button>
<Button variant="soft-primary">Soft Primary</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
```

#### Input & Label

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>
```

#### Select

```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select role" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="owner">Owner</SelectItem>
    <SelectItem value="manager">Manager</SelectItem>
  </SelectContent>
</Select>
```

---

### Feedback

#### StatusBadge

```tsx
<StatusBadge variant="success" showIcon>Completed</StatusBadge>
<StatusBadge variant="warning" showIcon>Pending</StatusBadge>
<StatusBadge variant="error" showIcon>Overdue</StatusBadge>
<StatusBadge variant="high" showIcon>High Priority</StatusBadge>
```

**Variants:** `default`, `success`, `warning`, `error`, `info`, `pending`, `active`, `inactive`, `high`, `medium`, `low`

#### Badge

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Overdue</Badge>
```

---

### Navigation

#### Tabs

```tsx
// Default
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
</Tabs>

// Pills
<TabsList variant="pills">
  <TabsTrigger variant="pills" value="day">Day</TabsTrigger>
  <TabsTrigger variant="pills" value="week">Week</TabsTrigger>
</TabsList>

// Underline
<TabsList variant="underline">
  <TabsTrigger variant="underline" value="tab1">Tab 1</TabsTrigger>
</TabsList>
```

---

### Overlays

#### Dialog

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### DropdownMenu

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Chart Colors

For Recharts (requires hex values):

```ts
const CHART_COLORS = {
  primary: '#F97316',   // Actual (orange)
  secondary: '#FDBA74', // Last year / Target (light orange)
  tertiary: '#FDBA74',  // Keep charts limited to orange family
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  muted: '#78716C',
  grid: '#E7E0DA',
}
```

### Chart palette rules

- **Trendlines / bar charts**: use **orange + light orange** only.
  - **Actual**: `#F97316`
  - **Last year + Target**: `#FDBA74` (target matches last year)
- **Green / Red / Yellow**: semantic-only (growth/loss/warning), not default chart series colors.

---

## Theme Switching

```tsx
import { useTheme } from "@/components/theme-provider"

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  
  return (
    <Button 
      variant="ghost" 
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
```

---

## Component Inventory

### shadcn/ui Components

Button, Input, Label, Card, Badge, Avatar, Separator, Skeleton, Dialog, DropdownMenu, Select, Tabs, Tooltip, Popover, Table, ScrollArea, Progress, Calendar, Command, Toggle, ToggleGroup, Collapsible, Sidebar

### Custom Components

- **StatCard** - KPI metrics with trend indicators
- **WidgetCard** - Container for dashboard widgets
- **ActivityList** - Recent activity with colored dots
- **ProgressRing** - Circular progress indicator
- **PageHeader** - Standardized page titles
- **StatusBadge** - Enhanced status indicators
- **AppSidebar** - Navigation sidebar with sections

---

## File Structure

````
src/
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── stat-card.tsx      ← Custom
│   │   ├── widget-card.tsx    ← Custom
│   │   ├── activity-list.tsx  ← Custom
│   │   ├── progress-ring.tsx  ← Custom
│   │   ├── page-header.tsx    ← Custom
│   │   ├── status-badge.tsx   ← Custom
│   │   ├── app-sidebar.tsx    ← Custom
│   │   └── index.ts
│   └── theme-provider.tsx
├── lib/utils.ts
├── index.css
└── tailwind.config.js
````

---

## Design Principles

1. **Clean & Neutral** - Light gray background, white cards, orange accents
2. **Clean & Minimal** - Generous whitespace, subtle shadows
3. **Consistent** - Use semantic tokens, not hardcoded colors
4. **Accessible** - Proper contrast, focus states
5. **Responsive** - Mobile-first layouts
# The Roof HRM - Design System

## Overview

This design system is built on **shadcn/ui** with **The Roof** brand identity tokens.

## Color Tokens

### Semantic Colors (CSS Variables)

These colors adapt automatically between light and dark mode:

| Token | Usage |
|-------|-------|
| `bg-background` | Page backgrounds |
| `bg-card` | Cards, elevated surfaces |
| `bg-muted` | Subtle backgrounds, hover states |
| `bg-primary` | Primary actions, brand accent |
| `bg-secondary` | Secondary surfaces |
| `border-border` | All borders |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary/subtle text |
| `text-primary` | Accent text, links |

### Status Colors

| Token | Usage |
|-------|-------|
| `text-success` / `bg-success` | Positive states, confirmations |
| `text-warning` / `bg-warning` | Warnings, pending states |
| `text-error` / `bg-error` | Errors, destructive actions |
| `text-info` / `bg-info` | Informational states |

### Brand Colors (Direct Access)

For specific brand requirements:

| Token | Hex | Usage |
|-------|-----|-------|
| `brand-burgundy` | #6C2B29 | Deep accents |
| `brand-terracotta` | #C74C3C | Primary brand color |
| `brand-coral` | #F5793B | CTAs, highlights |
| `brand-peach` | #E7C8B1 | Light accents |
| `brand-sand` | #F4E9D3 | Backgrounds |
| `brand-espresso` | #4A1F1C | Dark text |
| `brand-linen` | #FAF4EF | Light backgrounds |

### Chart Colors

For Recharts (requires hex values for SVG rendering). Use `src/lib/chart-colors.ts` as the single source of truth:

```js
import { BAR_COLORS, LINE_COLORS } from "@/lib/chart-colors"

// Series rules:
// - Actual: BAR_COLORS.current (orange)
// - Last year + Target: BAR_COLORS.previous / BAR_COLORS.target (light orange)
// - Semantic colors (success/error/warning) are status-only
```

## Typography

| Role | Font | Class |
|------|------|-------|
| Headers | Playfair Display | `font-serif` |
| Subheaders | Cormorant Garamond | `font-subheading` |
| Body | Inter | `font-sans` (default) |

## Components

All components are in `src/components/ui/`:

### Core Components
- `Button` - Primary actions with variants: default, secondary, outline, ghost, destructive, brand, coral, subtle
- `Input` - Form text inputs
- `Label` - Form labels
- `Card` - Container with CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `Badge` - Status indicators with variants: default, secondary, outline, success, warning, error, info, brand, subtle
- `Avatar` - User images with fallback
- `Separator` - Visual dividers
- `Skeleton` - Loading placeholders

### Composite Components
- `Dialog` - Modal dialogs
- `DropdownMenu` - Context menus
- `Select` - Dropdown selects
- `Tabs` - Tab navigation
- `Tooltip` - Hover tooltips
- `Popover` - Click popovers
- `Table` - Data tables
- `ScrollArea` - Custom scrollbars

## Usage Examples

### Card with KPI
```tsx
<Card>
  <CardHeader>
    <CardTitle>Monthly Revenue</CardTitle>
    <CardDescription>January 2026</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">₫1.2B</p>
    <p className="text-sm text-success">+12% from last month</p>
  </CardContent>
</Card>
```

### Status Badge
```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Overdue</Badge>
```

### Form Input
```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>
```

### Semantic Status Styling
```tsx
// Positive/Success
<div className="text-success">+12.5%</div>
<div className="bg-success/20 text-success">Under Budget</div>

// Warning
<div className="text-warning">Pending Review</div>
<div className="bg-warning/20 text-warning">Attention Needed</div>

// Error/Negative
<div className="text-error">-5.2%</div>
<div className="bg-error/20 text-error">Over Budget</div>

// Info
<div className="text-info">Scheduled</div>
<div className="bg-info/20 text-info">On Track</div>
```

## Theme Switching

The app supports light and dark modes via `ThemeProvider`:

```tsx
import { useTheme } from "@/components/theme-provider"

function MyComponent() {
  const { theme, setTheme } = useTheme()
  
  return (
    <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </Button>
  )
}
```

## File Structure

```
src/
├── components/
│   ├── ui/              # Design system components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   ├── popover.tsx
│   │   ├── table.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   ├── skeleton.tsx
│   │   ├── avatar.tsx
│   │   ├── label.tsx
│   │   └── index.ts      # Barrel export
│   ├── theme-provider.tsx
│   └── ...
├── lib/
│   └── utils.ts         # cn() utility
├── index.css            # CSS variables & tokens
└── tailwind.config.js   # Tailwind configuration
```

## Migration Notes

- Legacy `.card` CSS class is deprecated - use `Card` component
- Avoid hardcoded hex colors - use semantic tokens
- Exception: Recharts requires hex colors for SVG rendering
- All components support both light and dark mode automatically
- Use `text-foreground` instead of `text-white` or `text-slate-100`
- Use `text-muted-foreground` instead of `text-slate-400/500`
- Use `bg-card` instead of `bg-[#1a1f2e]`
- Use `bg-background` instead of `bg-[#0f1419]`
- Use `border-border` instead of `border-[#374151]`

## Color Migration Reference

| Old (Dark Mode Hardcoded) | New (Semantic Token) |
|---------------------------|----------------------|
| `bg-[#0f1419]` | `bg-background` |
| `bg-[#1a1f2e]` | `bg-card` |
| `border-[#374151]` | `border-border` |
| `text-white` | `text-foreground` |
| `text-slate-100/200/300` | `text-foreground` |
| `text-slate-400/500` | `text-muted-foreground` |
| `text-[#ff6b35]` | `text-primary` |
| `bg-[#ff6b35]` | `bg-primary` |
| `text-emerald-400` | `text-success` |
| `text-red-400` | `text-error` |
| `text-yellow-400` | `text-warning` |
| `text-blue-400` | `text-info` |
| `bg-emerald-500/20` | `bg-success/20` |
| `bg-red-500/20` | `bg-error/20` |
| `bg-yellow-500/20` | `bg-warning/20` |
