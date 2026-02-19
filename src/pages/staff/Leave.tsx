import { LeaveRequestForm } from '../../components/staff';

export function Leave() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Leave Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Request time off and track your leave balance
        </p>
      </div>

      {/* Leave Request Form with History */}
      <LeaveRequestForm />
    </div>
  );
}
