# Codebase Context

## Stack
- Framework: Vite + React 18 (`vite`, `react`, `react-dom`)
- Language: TypeScript
- Styling: Tailwind CSS (`tailwindcss`) + `src/index.css`
- UI Library: shadcn/ui-style components in `src/components/ui/*` (Radix UI + Tailwind), icons via `lucide-react`
- State Management: Zustand for auth/global state (`zustand`), React Query for server/cache state (`@tanstack/react-query`)

## Routing
- Pattern (App Router / Pages / Custom): React Router DOM (BrowserRouter + nested routes), defined in `src/App.tsx`
- Key routes:
  - `/login`: auth screen
  - `/`: protected shell (redirects to a role-appropriate dashboard)
  - Owner: `/owner/command-center`, `/owner/dashboard`, `/owner/my-dashboard`, `/owner/alerts`, `/owner/tasks`, `/owner/team-directory`, `/owner/org-chart`, `/owner/workforce`, `/owner/calendar`, `/owner/resources`
  - Manager: `/manager/dashboard`, `/manager/reservations`, `/manager/leave`, `/manager/announcements`, `/manager/shift-summary`, `/manager/promotions`, `/manager/events`, `/manager/schedule`, `/manager/incidents`, `/manager/onboarding`
  - Staff: `/staff/dashboard`, `/staff/payslips`, `/my-shifts`, `/profile`, `/tasks`, `/leave`
  - Finance (owner): `/finance/summary`, `/finance/pl`, `/finance/reports`, `/finance/category`, `/finance/cashflow`, `/finance/costs`, `/finance/forecast`
  - Common: `/announcements`, `/announcements/:id`, `/chat`, `/resources`, `/calendar`, `/kb`, `/design-system`

## Auth
- Current auth solution: Supabase Auth (email/password) via `@supabase/supabase-js` (`src/lib/supabase.ts`, `src/stores/authStore.ts`)
- Middleware:
  - Client-side gating:
    - `ProtectedRoute` (defined inline in `src/App.tsx`) blocks unauthenticated users and renders `DashboardLayout` for authenticated users
    - `RoleGuard` (`src/components/auth/RoleGuard.tsx`) restricts pages by role
  - Server-side enforcement: Supabase Row Level Security policies in `supabase/migrations/*` (role-based policies for core tables)
- User roles (if any): `owner | manager | staff` stored on `profiles.role` (created/updated by SQL trigger and fetched client-side)

## Current State
- What works:
  - Working Vite SPA entrypoint with React Router + nested route layout (`src/main.tsx`, `src/App.tsx`)
  - Auth store with session bootstrap + auth state listener (`useAuthStore.initialize`) and login/signup UI (`src/pages/auth/Login.tsx`)
  - Role-based routing for most major sections (owner/manager/finance/admin) using `RoleGuard`
  - Supabase schema + migrations exist for core HRM-ish data (`profiles`, `shifts`, org hierarchy via `profiles.reports_to`, metrics, reviews, etc.)
- What’s missing:
  - Fine-grained permissions beyond 3 roles (there are “Permissions/Roles/SOPs” settings pages, but RBAC looks role-only in routing; no per-feature permission checks surfaced in routing)
  - Production-safe handling when `profiles` fetch fails (DEV has a fallback profile; production does not)
  - Clear “single source of truth” for route protection (there are two `ProtectedRoute` implementations: one inline in `src/App.tsx` and another in `src/components/auth/ProtectedRoute.tsx`)
  - Repo cleanup/decision on extra template folders (`shadcn-admin/`, `shadcn-dashboard-landing-template/`, `my-app/`) vs the active app in `src/`
- Known issues:
  - Duplicate/competing route guard implementations: `src/App.tsx` defines its own `ProtectedRoute`, while `src/components/auth/ProtectedRoute.tsx` also exists (easy to drift / confuse future edits)
  - `RoleGuard` returns `null` when `profile` hasn’t loaded yet; if profile loading fails in production, some routes can render blank (parent auth gate only checks `user`, not profile integrity)
  - Auth initialization uses a 5s timeout and then sets `initialized: true` regardless; this can mask slow session/profile fetches and create confusing “logged out” redirects on slow networks

## Goals
- Build navigation shell
- Add authentication
- Prepare for scaling (internal HRM)
