import { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Loader2, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { useCreateLeaveRequest, useMyLeaveRequests, useLeaveBalance, useCancelLeaveRequest } from '../../hooks/useLeaveRequests';
import type { LeaveType, LeaveStatus } from '../../types';

const leaveTypes: { value: LeaveType; label: string; description: string }[] = [
  { value: 'annual', label: 'Annual Leave', description: 'Regular vacation days' },
  { value: 'sick', label: 'Sick Leave', description: 'Medical illness or appointments' },
  { value: 'personal', label: 'Personal Leave', description: 'Personal matters' },
  { value: 'emergency', label: 'Emergency Leave', description: 'Urgent family matters' },
  { value: 'unpaid', label: 'Unpaid Leave', description: 'Leave without pay' },
];

const statusConfig: Record<LeaveStatus, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-warning', bg: 'bg-warning/20', icon: Clock },
  approved: { label: 'Approved', color: 'text-success', bg: 'bg-success/20', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-error', bg: 'bg-error/20', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground', bg: 'bg-muted', icon: XCircle },
};

export function LeaveRequestForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'annual' as LeaveType,
    reason: '',
  });
  const [error, setError] = useState<string | null>(null);

  const createRequest = useCreateLeaveRequest();
  const balance = useLeaveBalance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.startDate || !formData.endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError('End date must be after start date');
      return;
    }

    try {
      await createRequest.mutateAsync({
        startDate: formData.startDate,
        endDate: formData.endDate,
        leaveType: formData.leaveType,
        reason: formData.reason || undefined,
      });
      setIsOpen(false);
      setFormData({ startDate: '', endDate: '', leaveType: 'annual', reason: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    }
  };

  return (
    <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
      {/* Header with balance */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/20 p-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Leave Balance</h3>
              <p className="text-sm text-muted-foreground">
                {balance.remainingDays} days remaining of {balance.annualLeaveDays}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Request Leave
          </button>
        </div>
      </div>

      {/* Request Form */}
      {isOpen && (
        <form onSubmit={handleSubmit} className="p-4 border-b border-border bg-muted/30">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(f => ({ ...f, startDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(f => ({ ...f, endDate: e.target.value }))}
                min={formData.startDate || new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>

            {/* Leave Type */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">
                Leave Type
              </label>
              <div className="relative">
                <select
                  value={formData.leaveType}
                  onChange={(e) => setFormData(f => ({ ...f, leaveType: e.target.value as LeaveType }))}
                  className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {leaveTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData(f => ({ ...f, reason: e.target.value }))}
                placeholder="Brief description..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRequest.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {createRequest.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Request
            </button>
          </div>
        </form>
      )}

      {/* Request History */}
      <LeaveRequestHistory />
    </div>
  );
}

function LeaveRequestHistory() {
  const { data: requests, isLoading } = useMyLeaveRequests();
  const cancelRequest = useCancelLeaveRequest();

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!requests?.length) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No leave requests yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {requests.slice(0, 5).map((request) => {
        const config = statusConfig[request.status];
        const StatusIcon = config.icon;

        return (
          <div key={request.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-1.5 ${config.bg}`}>
                <StatusIcon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div>
                <p className="text-sm text-foreground">
                  {formatDateRange(request.startDate, request.endDate)}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground capitalize">
                    {request.leaveType.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${config.bg} ${config.color}`}>
                {config.label}
              </span>
              {request.status === 'pending' && (
                <button
                  onClick={() => cancelRequest.mutate(request.id)}
                  disabled={cancelRequest.isPending}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-error hover:bg-error/10 transition-colors"
                  title="Cancel request"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compact widget for dashboard
export interface LeaveBalanceWidgetProps {
  /** If true, renders content only without extra background wrapper */
  noContainer?: boolean;
}

export function LeaveBalanceWidget({ noContainer = false }: LeaveBalanceWidgetProps) {
  const balance = useLeaveBalance();
  const usedPercentage = Math.round((balance.leaveDaysUsed / balance.annualLeaveDays) * 100);

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Annual leave</span>
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="text-lg font-semibold text-foreground">{balance.remainingDays} days</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${usedPercentage}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {balance.leaveDaysUsed}/{balance.annualLeaveDays}
        </span>
      </div>
    </>
  );

  if (noContainer) {
    return <div className="space-y-2">{content}</div>;
  }

  return (
    <div className="rounded-lg bg-background p-3">
      {content}
    </div>
  );
}

// Helper
function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  
  if (start === end) {
    return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' });
  }
  
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
}
