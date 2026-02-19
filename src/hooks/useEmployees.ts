import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"

export type EmployeeRole = "owner" | "manager" | "staff"
export type EmploymentType = "full_time" | "part_time" | "casual"

export type EmployeeProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: EmployeeRole
  avatar_url: string | null
  phone: string | null
  hire_date: string | null
  job_role: string | null
  department: string | null
  employment_type: string | null
  manager_type: string | null
  reports_to: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type EmploymentHistoryRow = {
  id: string
  employee_id: string
  job_title: string
  industry_job_title: string | null
  start_date: string
  end_date: string | null
  employment_type: EmploymentType
  team: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type LeaveType = "annual" | "birthday" | "sick" | "time_in_lieu"

export type LeaveBalanceRow = {
  employee_id: string
  leave_type: LeaveType
  balance_days: number
  used_days: number
  created_at: string
  updated_at: string
}

export function useEmployeeProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["employee-profile", userId],
    queryFn: async (): Promise<EmployeeProfile> => {
      if (!userId) throw new Error("Missing userId")

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, avatar_url, phone, hire_date, job_role, department, employment_type, manager_type, reports_to, is_active, created_at, updated_at",
        )
        .eq("id", userId)
        .single()

      if (error) throw error
      return data as EmployeeProfile
    },
    enabled: !!userId,
  })
}

export function useUpdateEmployeeProfile(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<
          EmployeeProfile,
          | "full_name"
          | "phone"
          | "hire_date"
          | "job_role"
          | "department"
          | "employment_type"
          | "reports_to"
          | "is_active"
        >
      >,
    ) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select(
          "id, email, full_name, role, avatar_url, phone, hire_date, job_role, department, employment_type, manager_type, reports_to, is_active, created_at, updated_at",
        )
        .single()

      if (error) throw error
      return data as EmployeeProfile
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-profile", userId] })
      qc.invalidateQueries({ queryKey: ["staff-list"] })
      qc.invalidateQueries({ queryKey: ["org_chart"] })
    },
  })
}

export function useEmploymentHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["employment-history", userId],
    queryFn: async (): Promise<EmploymentHistoryRow[]> => {
      if (!userId) throw new Error("Missing userId")
      const { data, error } = await supabase
        .from("employment_history")
        .select(
          "id, employee_id, job_title, industry_job_title, start_date, end_date, employment_type, team, notes, created_at, updated_at",
        )
        .eq("employee_id", userId)
        .order("start_date", { ascending: false })

      if (error) throw error
      return (data || []) as EmploymentHistoryRow[]
    },
    enabled: !!userId,
  })
}

export function useAddEmploymentHistory(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      job_title: string
      industry_job_title?: string | null
      start_date: string
      end_date?: string | null
      employment_type: EmploymentType
      team?: string | null
      notes?: string | null
    }) => {
      const { data, error } = await supabase
        .from("employment_history")
        .insert({
          employee_id: userId,
          job_title: input.job_title,
          industry_job_title: input.industry_job_title ?? null,
          start_date: input.start_date,
          end_date: input.end_date ?? null,
          employment_type: input.employment_type,
          team: input.team ?? null,
          notes: input.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .select(
          "id, employee_id, job_title, industry_job_title, start_date, end_date, employment_type, team, notes, created_at, updated_at",
        )
        .single()

      if (error) throw error
      return data as EmploymentHistoryRow
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employment-history", userId] })
    },
  })
}

export function useLeaveBalances(userId: string | undefined) {
  return useQuery({
    queryKey: ["leave-balances", userId],
    queryFn: async (): Promise<LeaveBalanceRow[]> => {
      if (!userId) throw new Error("Missing userId")
      const { data, error } = await supabase
        .from("leave_balances")
        .select("employee_id, leave_type, balance_days, used_days, created_at, updated_at")
        .eq("employee_id", userId)
        .order("leave_type")

      if (error) throw error
      return ((data || []) as any[]).map((r) => ({
        ...r,
        balance_days: Number(r.balance_days ?? 0),
        used_days: Number(r.used_days ?? 0),
      })) as LeaveBalanceRow[]
    },
    enabled: !!userId,
  })
}

export function useUpsertLeaveBalance(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { leave_type: LeaveType; balance_days: number; used_days: number }) => {
      const { data, error } = await supabase
        .from("leave_balances")
        .upsert(
          {
            employee_id: userId,
            leave_type: input.leave_type,
            balance_days: input.balance_days,
            used_days: input.used_days,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "employee_id,leave_type" },
        )
        .select("employee_id, leave_type, balance_days, used_days, created_at, updated_at")
        .single()

      if (error) throw error
      return {
        ...(data as any),
        balance_days: Number((data as any).balance_days ?? 0),
        used_days: Number((data as any).used_days ?? 0),
      } as LeaveBalanceRow
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-balances", userId] })
    },
  })
}

