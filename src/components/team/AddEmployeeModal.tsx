import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type UserRole = "owner" | "manager" | "staff"
type EmploymentType = "full_time" | "part_time" | "casual"
type ManagerType = "bar" | "floor" | "marketing" | "none"

type FormState = {
  full_name: string
  email: string
  role: UserRole
  phone: string
  hire_date: string
  employment_type: EmploymentType
  job_role: string
  department: string
  manager_type: ManagerType
  reports_to: string
}

export function AddEmployeeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => ({
    full_name: "",
    email: "",
    role: "staff",
    phone: "",
    hire_date: new Date().toISOString().split("T")[0],
    employment_type: "full_time",
    job_role: "",
    department: "",
    manager_type: "none",
    reports_to: "",
  }))

  const canSetManagerType = form.role === "manager"

  const payload = useMemo(() => {
    return {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      phone: form.phone.trim() || null,
      hire_date: form.hire_date || null,
      employment_type: form.employment_type || null,
      job_role: form.job_role.trim() || null,
      department: form.department.trim() || null,
      manager_type: canSetManagerType
        ? form.manager_type === "none"
          ? null
          : form.manager_type
        : null,
      reports_to: form.reports_to.trim() || null,
    }
  }, [form, canSetManagerType])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError
      if (!session?.access_token) {
        throw new Error("You are not logged in. Please sign in again.")
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const res = await fetch(
        `${supabaseUrl}/functions/v1/create-employee`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      )

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          data?.error ||
          data?.msg ||
          data?.message ||
          `Request failed (${res.status})`

        // Surface debug hints from the Edge Function when available
        const dbg = data?.debug
        if (dbg && typeof dbg === "object") {
          const parts = [
            dbg.hint && `${dbg.hint}`,
            dbg.code && `code: ${dbg.code}`,
            dbg.details && `details: ${dbg.details}`,
            dbg.tokenRole && `tokenRole: ${dbg.tokenRole}`,
          ]
            .filter(Boolean)
            .join(" | ")
          throw new Error(parts ? `${msg}\n${parts}` : msg)
        }
        throw new Error(msg)
      }

      if (!data?.success) {
        throw new Error(data?.error || "Failed to add employee")
      }

      // Refresh directory list
      qc.invalidateQueries({ queryKey: ["staff-list"] })

      // Reset form for next time
      setForm((prev) => ({
        ...prev,
        full_name: "",
        email: "",
        phone: "",
        job_role: "",
        department: "",
        reports_to: "",
        role: "staff",
        manager_type: "none",
        employment_type: "full_time",
        hire_date: new Date().toISOString().split("T")[0],
      }))

      onClose()
    } catch (err) {
      const message = (err as Error)?.message || "Something went wrong"
      if (message.toLowerCase().includes("failed to fetch")) {
        setError(
          "Failed to reach the Edge Function. Make sure `create-employee` is deployed in Supabase (and you’re online), then try again."
        )
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open && !loading) {
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-wrap">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="full_name">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
              placeholder="John Smith"
              disabled={loading}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              placeholder="john@theroof.com"
              disabled={loading}
              required
            />
            <p className="text-xs text-muted-foreground">
              An account will be created. They can sign in via password reset.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              placeholder="+84 123 456 789"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, role: v as UserRole, manager_type: "none" }))
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Employment type</Label>
              <Select
                value={form.employment_type}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, employment_type: v as EmploymentType }))
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full time</SelectItem>
                  <SelectItem value="part_time">Part time</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {canSetManagerType && (
            <div className="grid gap-2">
              <Label>Manager type (optional)</Label>
              <Select
                value={form.manager_type}
                onValueChange={(v) => setForm((s) => ({ ...s, manager_type: v as ManagerType }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="floor">Floor</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="hire_date">Hire date</Label>
              <Input
                id="hire_date"
                type="date"
                value={form.hire_date}
                onChange={(e) => setForm((s) => ({ ...s, hire_date: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={form.department}
                onChange={(e) => setForm((s) => ({ ...s, department: e.target.value }))}
                placeholder="Service, Bar, Kitchen…"
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="job_role">Job role (optional)</Label>
            <Input
              id="job_role"
              value={form.job_role}
              onChange={(e) => setForm((s) => ({ ...s, job_role: e.target.value }))}
              placeholder="service, bartender, floor_manager…"
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reports_to">Reports to (optional)</Label>
            <Input
              id="reports_to"
              value={form.reports_to}
              onChange={(e) => setForm((s) => ({ ...s, reports_to: e.target.value }))}
              placeholder="Manager UUID"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              We’ll replace this with a people picker later.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "+ Add Employee"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

