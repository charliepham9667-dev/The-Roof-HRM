import { useState } from 'react';
import { 
  Clock, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useClockIn, useClockOut, useClockStatus, useVenueSettings } from '../../hooks/useClockRecords';
import { formatTime } from '../../lib/formatters';

export interface ClockInOutProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function ClockInOut({ noContainer = false }: ClockInOutProps) {
  const { isClockedIn, lastClockIn, lastClockOut, isLoading: statusLoading } = useClockStatus();
  const { data: venue } = useVenueSettings();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  
  const [showResult, setShowResult] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    distance?: number;
  } | null>(null);

  const handleClockIn = async () => {
    try {
      const result = await clockIn.mutateAsync({});
      if (result.isWithinGeofence) {
        setShowResult({
          type: 'success',
          message: 'Clocked in successfully!',
          distance: result.distanceFromVenue,
        });
      } else {
        setShowResult({
          type: 'warning',
          message: `Clocked in, but you're ${Math.round(result.distanceFromVenue || 0)}m away from venue`,
          distance: result.distanceFromVenue,
        });
      }
    } catch (err: any) {
      setShowResult({
        type: 'error',
        message: err.message || 'Failed to clock in',
      });
    }
    setTimeout(() => setShowResult(null), 5000);
  };

  const handleClockOut = async () => {
    try {
      const result = await clockOut.mutateAsync({});
      setShowResult({
        type: 'success',
        message: 'Clocked out successfully!',
        distance: result.distanceFromVenue,
      });
    } catch (err: any) {
      setShowResult({
        type: 'error',
        message: err.message || 'Failed to clock out',
      });
    }
    setTimeout(() => setShowResult(null), 5000);
  };

  const isLoading = clockIn.isPending || clockOut.isPending;

  // Calculate worked time today
  const getWorkedTime = () => {
    if (!lastClockIn) return null;
    const start = new Date(lastClockIn.clockTime);
    const end = lastClockOut ? new Date(lastClockOut.clockTime) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (statusLoading) {
    if (noContainer) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const content = (
    <>
      {noContainer && (
        <div className="flex items-center justify-end">
          <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
            isClockedIn 
              ? 'bg-success/20 text-success' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isClockedIn ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            {isClockedIn ? 'On Duty' : 'Off Duty'}
          </div>
        </div>
      )}

      {/* Time Info */}
      {lastClockIn && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-background p-3">
            <p className="text-xs text-muted-foreground mb-1">Clocked In</p>
            <p className="text-lg font-semibold text-foreground">
              {formatTime(lastClockIn.clockTime)}
            </p>
            {lastClockIn.isWithinGeofence ? (
              <div className="flex items-center gap-1 mt-1 text-xs text-success">
                <MapPin className="h-3 w-3" />
                At venue
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                {Math.round(lastClockIn.distanceFromVenue || 0)}m away
              </div>
            )}
          </div>
          
          {isClockedIn ? (
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Time Worked</p>
              <p className="text-lg font-semibold text-success">
                {getWorkedTime()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">and counting...</p>
            </div>
          ) : lastClockOut ? (
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Clocked Out</p>
              <p className="text-lg font-semibold text-foreground">
                {formatTime(lastClockOut.clockTime)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total: {getWorkedTime()}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Result Message */}
      {showResult && (
        <div className={`rounded-lg p-3 flex items-center gap-2 ${
          showResult.type === 'success' ? 'bg-success/20 text-success' :
          showResult.type === 'warning' ? 'bg-warning/20 text-warning' :
          'bg-error/20 text-error'
        }`}>
          {showResult.type === 'success' ? <CheckCircle className="h-4 w-4" /> :
           showResult.type === 'warning' ? <AlertTriangle className="h-4 w-4" /> :
           <XCircle className="h-4 w-4" />}
          <span className="text-sm">{showResult.message}</span>
        </div>
      )}

      {/* Clock Button */}
      <button
        onClick={isClockedIn ? handleClockOut : handleClockIn}
        disabled={isLoading}
        className={`w-full rounded-control py-4 font-semibold text-white transition-all flex items-center justify-center gap-2 ${
          isClockedIn
            ? 'bg-error hover:bg-error/90 active:scale-[0.98]'
            : 'bg-success hover:bg-success/90 active:scale-[0.98]'
        } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : isClockedIn ? (
          <>
            <XCircle className="h-5 w-5" />
            Clock Out
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5" />
            Clock In
          </>
        )}
      </button>

      {/* Location notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>
          Location tracking enabled • Geofence: {venue?.geofenceRadiusMeters || 100}m radius
        </span>
      </div>
    </>
  );

  if (noContainer) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${isClockedIn ? 'bg-success/20' : 'bg-muted'}`}>
            <Clock className={`h-5 w-5 ${isClockedIn ? 'text-success' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Time Clock</h3>
            <p className="text-sm text-muted-foreground">
              {isClockedIn ? 'Currently on shift' : 'Not clocked in'}
            </p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
          isClockedIn 
            ? 'bg-success/20 text-success' 
            : 'bg-muted text-muted-foreground'
        }`}>
          <span className={`h-2 w-2 rounded-full ${isClockedIn ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
          {isClockedIn ? 'On Duty' : 'Off Duty'}
        </div>
      </div>

      <div className="space-y-4">{content}</div>
    </div>
  );
}

// Quick clock widget for dashboard
export function ClockWidget() {
  const { isClockedIn, isLoading } = useClockStatus();
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  const handleClick = () => {
    if (isClockedIn) {
      clockOut.mutate({});
    } else {
      clockIn.mutate({});
    }
  };

  const isPending = clockIn.isPending || clockOut.isPending;

  return (
    <button
      onClick={handleClick}
      disabled={isPending || isLoading}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        isClockedIn
          ? 'bg-success/20 text-success hover:bg-success/30'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      {isClockedIn ? (
        <>
          <span className="hidden sm:inline">On Duty</span>
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        </>
      ) : (
        <span className="hidden sm:inline">Clock In</span>
      )}
    </button>
  );
}
