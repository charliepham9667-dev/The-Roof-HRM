import { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { 
  usePendingLeaveRequests, 
  useReviewLeaveRequest,
  useLeaveRequestsInRange 
} from '../../hooks/useLeaveRequests';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../../types';

const statusConfig: Record<LeaveStatus, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-warning', bg: 'bg-warning/20', icon: Clock },
  approved: { label: 'Approved', color: 'text-success', bg: 'bg-success/20', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-error', bg: 'bg-error/20', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground', bg: 'bg-muted', icon: XCircle },
};

const leaveTypeLabels: Record<LeaveType, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  emergency: 'Emergency Leave',
  unpaid: 'Unpaid Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
};

export function LeaveApproval() {
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const { data: pendingRequests, isLoading: loadingPending } = usePendingLeaveRequests();
  
  // Get all requests for last 30 days to next 60 days
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 60);
  
  const { data: allRequests, isLoading: loadingAll } = useLeaveRequestsInRange(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );

  const isLoading = view === 'pending' ? loadingPending : loadingAll;
  const requests = view === 'pending' ? pendingRequests : allRequests;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve staff time-off requests
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex rounded-lg bg-card border border-border p-1">
          <button
            onClick={() => setView('pending')}
            className={`flex items-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors ${
              view === 'pending'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Pending
            {pendingRequests && pendingRequests.length > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('all')}
            className={`flex items-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors ${
              view === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="h-4 w-4" />
            All Requests
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !requests?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2 text-success" />
            <p>{view === 'pending' ? 'No pending requests' : 'No leave requests found'}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <LeaveRequestCard key={request.id} request={request} showActions={view === 'pending'} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface LeaveRequestCardProps {
  request: LeaveRequest;
  showActions: boolean;
}

function LeaveRequestCard({ request, showActions }: LeaveRequestCardProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const reviewRequest = useReviewLeaveRequest();

  const config = statusConfig[request.status];

  const handleApprove = () => {
    reviewRequest.mutate({
      requestId: request.id,
      status: 'approved',
    });
  };

  const handleReject = () => {
    reviewRequest.mutate({
      requestId: request.id,
      status: 'rejected',
      reviewNote: rejectNote || undefined,
    });
    setShowRejectModal(false);
    setRejectNote('');
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (start === end) {
      return startDate.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
    
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Request Info */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {request.staff?.avatarUrl ? (
              <img 
                src={request.staff.avatarUrl} 
                alt="" 
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                {request.staff?.fullName?.split(' ').map(n => n[0]).join('') || '?'}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground">{request.staff?.fullName || 'Staff'}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${config.bg} ${config.color}`}>
                {config.label}
              </span>
            </div>
            
            <div className="mt-1 space-y-1">
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground/80">{leaveTypeLabels[request.leaveType]}</span>
                {' • '}
                {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateRange(request.startDate, request.endDate)}
              </p>
              {request.reason && (
                <p className="text-sm text-muted-foreground mt-2">
                  "{request.reason}"
                </p>
              )}
            </div>

            {/* Review info */}
            {request.reviewedAt && request.reviewer && (
              <p className="text-xs text-muted-foreground mt-2">
                {request.status === 'approved' ? 'Approved' : 'Rejected'} by {request.reviewer.fullName}
                {request.reviewNote && ` - "${request.reviewNote}"`}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && request.status === 'pending' && (
          <div className="flex items-center gap-2 sm:flex-shrink-0">
            <button
              onClick={handleApprove}
              disabled={reviewRequest.isPending}
              className="flex items-center gap-1 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 transition-colors disabled:opacity-50"
            >
              {reviewRequest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={reviewRequest.isPending}
              className="flex items-center gap-1 rounded-lg bg-error/20 px-4 py-2 text-sm font-medium text-error hover:bg-error/30 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowRejectModal(false)} />
          <div className="relative w-full max-w-md rounded-card border border-border bg-card p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Reject Request</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Optionally provide a reason for rejecting this leave request.
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={reviewRequest.isPending}
                className="flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {reviewRequest.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
