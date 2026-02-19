import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export interface OrgMember {
  id: string
  full_name: string
  email: string
  role: "owner" | "manager" | "staff"
  job_role: string | null
  department: string | null
  reports_to: string | null
  avatar_url: string | null
  employment_type: string | null
  is_active: boolean
  created_at: string
  direct_reports?: OrgMember[]
}

export function useOrgChart() {
  const profile = useAuthStore((s) => s.profile)

  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["org_chart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, role, job_role, department, reports_to, avatar_url, employment_type, is_active, created_at",
        )
        .order("role", { ascending: true })
        .order("full_name", { ascending: true })

      if (error) throw error
      return data as OrgMember[]
    },
    enabled: !!profile,
  })

  const orgTree = buildOrgTree(members)

  return { members, orgTree, isLoading, error }
}

function buildOrgTree(members: OrgMember[]): OrgMember | null {
  if (members.length === 0) return null

  const memberMap = new Map<string, OrgMember>()
  members.forEach((m) => {
    memberMap.set(m.id, { ...m, direct_reports: [] })
  })

  let root: OrgMember | null = null

  memberMap.forEach((member) => {
    if (member.reports_to && memberMap.has(member.reports_to)) {
      const manager = memberMap.get(member.reports_to)!
      manager.direct_reports = manager.direct_reports || []
      manager.direct_reports.push(member)
    } else if (member.role === "owner" && !root) {
      root = member
    }
  })

  if (!root) {
    const fallback = members.find((m) => m.role === "owner") || members[0]
    root = memberMap.get(fallback.id) || fallback
  }

  return root
}

export function useUpdateReportsTo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, reportsTo }: { memberId: string; reportsTo: string | null }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ reports_to: reportsTo })
        .eq("id", memberId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_chart"] })
    },
  })
}

