import { useEffect, useState } from "react"
import { Loader2, Shield } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useUpdateEmployeeProfile } from "@/hooks/useEmployees"
import { useAuthStore } from "@/stores/authStore"
import type { ManagerType, UserRole } from "@/types"

const BASE_ROLES: { value: UserRole; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "manager", label: "Manager" },
]
const OWNER_ROLE: { value: UserRole; label: string } = { value: "owner", label: "Owner" }

const MANAGER_TYPES: { value: Exclude<ManagerType, null>; label: string }[] = [
  { value: "bar", label: "Bar Manager" },
  { value: "floor", label: "Floor Manager" },
  { value: "marketing", label: "Marketing Manager" },
]

export function EditAccessModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  currentRole,
  currentManagerType,
}: {
  isOpen: boolean
  onClose: () => void
  employeeId: string
  employeeName: string
  currentRole: UserRole
  currentManagerType: ManagerType | null
}) {
  const [role, setRole] = useState<UserRole>(currentRole)
  const [managerType, setManagerType] = useState<ManagerType | "">(
    currentManagerType ?? ""
  )

  const updateProfile = useUpdateEmployeeProfile(employeeId)
  const isOwner = useAuthStore((s) => s.isOwner())
  const roles = isOwner ? [...BASE_ROLES, OWNER_ROLE] : BASE_ROLES

  const [showOwnerConfirm, setShowOwnerConfirm] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setRole(currentRole)
      setManagerType(currentManagerType ?? "")
    }
  }, [isOpen, currentRole, currentManagerType])

  const handleSaveClick = () => {
    if (role === "owner") {
      setShowOwnerConfirm(true)
      return
    }
    performSave()
  }

  const performSave = () => {
    setShowOwnerConfirm(false)
    const payload: { role: UserRole; manager_type: ManagerType | null } = {
      role,
      manager_type: role === "manager" && managerType ? managerType : null,
    }

    updateProfile.mutate(payload, {
      onSuccess: () => {
        const managerLabel =
          role === "owner"
            ? "Owner"
            : role === "manager" && managerType
              ? MANAGER_TYPES.find((t) => t.value === managerType)?.label ??
                managerType
              : role
        toast.success(
          `${employeeName} now has ${managerLabel} access. They may need to sign out and back in to see changes.`
        )
        onClose()
      },
      onError: (err) => {
        toast.error((err as Error)?.message ?? "Failed to update access")
      },
    })
  }

  const canSetManagerType = role === "manager"

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(o) => !o && (setShowOwnerConfirm(false), onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Change access
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Update access level for <span className="font-medium text-foreground">{employeeName}</span>.
          </p>

          <div className="grid gap-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v as UserRole)
                if (v !== "manager") setManagerType("")
              }}
              disabled={updateProfile.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canSetManagerType && (
            <div className="grid gap-2">
              <Label>Manager type</Label>
              <Select
                value={managerType || "none"}
                onValueChange={(v) =>
                  setManagerType(v === "none" ? "" : (v as ManagerType))
                }
                disabled={updateProfile.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {MANAGER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Bar Manager, Floor Manager, and Marketing Manager each have different dashboard and scheduling access.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={updateProfile.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveClick}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save access"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showOwnerConfirm} onOpenChange={setShowOwnerConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Promote to Owner?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          Promoting <span className="font-medium text-foreground">{employeeName}</span> to Owner grants full access to the system, including team management, financial data, and all dashboards. Are you sure?
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowOwnerConfirm(false)}>
            Cancel
          </Button>
          <Button
            onClick={performSave}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Yes, promote to Owner"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
