import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import OwnerDashboardPage from "./dashboard/index"

export function OwnerDashboard() {
  const viewAs = useAuthStore((s) => s.viewAs)

  if (viewAs?.role === "manager") {
    return <Navigate to="/manager/dashboard" replace />
  }

  return <OwnerDashboardPage />
}

export default OwnerDashboard

