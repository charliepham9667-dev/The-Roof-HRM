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
  date_of_birth: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  contract_signed: boolean
  contract_signed_date: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  contract_type: string | null
  created_at?: string
  updated_at?: string
}

// We attempt the full SELECT first (including contract_* columns added in
// migration 20260501000000_profiles_contract_fields.sql) and fall back to the
// legacy column set if the migration has not yet been applied, so the UI
// stays functional during a staggered deploy.
const PROFILE_SELECT_COLUMNS =
  "id, email, full_name, role, avatar_url, phone, hire_date, job_role, department, employment_type, manager_type, reports_to, is_active, date_of_birth, address, emergency_contact_name, emergency_contact_phone, contract_signed, contract_signed_date, contract_start_date, contract_end_date, contract_type, created_at, updated_at"

const PROFILE_SELECT_COLUMNS_LEGACY =
  "id, email, full_name, role, avatar_url, phone, hire_date, job_role, department, employment_type, manager_type, reports_to, is_active, date_of_birth, address, emergency_contact_name, emergency_contact_phone, created_at, updated_at"

const CONTRACT_FIELDS = [
  "contract_signed",
  "contract_signed_date",
  "contract_start_date",
  "contract_end_date",
  "contract_type",
] as const

function isMissingColumnError(err: any): boolean {
  if (!err) return false
  if (err.code === "42703") return true
  const msg = String(err.message || "").toLowerCase()
  return /column .* does not exist/.test(msg) || msg.includes("contract_")
}

function withContractDefaults(row: any): EmployeeProfile {
  return {
    contract_signed: false,
    contract_signed_date: null,
    contract_start_date: null,
    contract_end_date: null,
    contract_type: null,
    ...row,
  } as EmployeeProfile
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

      const first = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS)
        .eq("id", userId)
        .single()

      if (!first.error) {
        return withContractDefaults(first.data)
      }

      if (isMissingColumnError(first.error)) {
        console.warn(
          "[useEmployeeProfile] contract_* columns missing — falling back to legacy SELECT.",
        )
        const fallback = await supabase
          .from("profiles")
          .select(PROFILE_SELECT_COLUMNS_LEGACY)
          .eq("id", userId)
          .single()
        if (fallback.error) throw fallback.error
        return withContractDefaults(fallback.data)
      }

      throw first.error
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
          | "email"
          | "phone"
          | "hire_date"
          | "job_role"
          | "department"
          | "employment_type"
          | "reports_to"
          | "is_active"
          | "date_of_birth"
          | "address"
          | "emergency_contact_name"
          | "emergency_contact_phone"
          | "role"
          | "manager_type"
          | "contract_signed"
          | "contract_signed_date"
          | "contract_start_date"
          | "contract_end_date"
          | "contract_type"
        >
      >,
    ) => {
      // Route through edge function to bypass RLS
      const res = await supabase.functions.invoke("approve-employee", {
        body: { profileId: userId, action: "update-profile", fields: patch },
      })
      if (res.error) throw new Error(res.error.message)
      if (res.data?.error) throw new Error(res.data.error)

      // Re-fetch the full profile so callers get up-to-date data
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS)
        .eq("id", userId)
        .single()
      if (error) throw error
      return withContractDefaults(data)
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

export function useUpdateEmploymentHistory(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string
      job_title?: string
      industry_job_title?: string | null
      start_date?: string
      end_date?: string | null
      employment_type?: EmploymentType
      team?: string | null
      notes?: string | null
    }) => {
      const { data, error } = await supabase
        .from("employment_history")
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("employee_id", userId)
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

export function useDeleteEmploymentHistory(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employment_history")
        .delete()
        .eq("id", id)
        .eq("employee_id", userId)

      if (error) throw error
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

