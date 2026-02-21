import { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Users,
  Phone,
  Clock,
  Mail,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useReservationsCsv, type CsvReservation, type ReservationStatus } from '../../hooks/useReservationsCsv';

const statusConfig: Record<ReservationStatus, { label: string; textColor: string; bgColor: string; borderColor: string; dotColor: string }> = {
  past: {
    label: 'Past',
    textColor: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    dotColor: 'bg-red-400',
  },
  today: {
    label: 'Today',
    textColor: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    dotColor: 'bg-green-400',
  },
  upcoming: {
    label: 'Upcoming',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    dotColor: 'bg-blue-400',
  },
};

export function Reservations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: reservations = [], isLoading, isFetching, refetch, error } = useReservationsCsv();

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      if (!matchesStatus) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (r.name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.dateRaw || '').toLowerCase().includes(q)
      );
    });
  }, [reservations, statusFilter, searchQuery]);

  const counts = useMemo(() => ({
    past: reservations.filter((r) => r.status === 'past').length,
    today: reservations.filter((r) => r.status === 'today').length,
    upcoming: reservations.filter((r) => r.status === 'upcoming').length,
    total: reservations.length,
  }), [reservations]);

  const todayPax = useMemo(() =>
    reservations
      .filter((r) => r.status === 'today')
      .reduce((sum, r) => sum + r.numberOfGuests, 0),
    [reservations]
  );

  const upcomingPax = useMemo(() =>
    reservations
      .filter((r) => r.status === 'upcoming')
      .reduce((sum, r) => sum + r.numberOfGuests, 0),
    [reservations]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Reservations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live from reservation form · updates every 5 minutes
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex shrink-0 whitespace-nowrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter('today')}
          className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'today' ? 'border-green-500/40 bg-green-500/10' : 'border-border bg-card hover:bg-muted/30'}`}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <p className="text-xl font-bold text-green-400">{counts.today}</p>
          <p className="text-xs text-muted-foreground">{todayPax} guests</p>
        </button>
        <button
          onClick={() => setStatusFilter('upcoming')}
          className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'upcoming' ? 'border-blue-500/40 bg-blue-500/10' : 'border-border bg-card hover:bg-muted/30'}`}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
          <p className="text-xl font-bold text-blue-400">{counts.upcoming}</p>
          <p className="text-xs text-muted-foreground">{upcomingPax} guests</p>
        </button>
        <button
          onClick={() => setStatusFilter('past')}
          className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'past' ? 'border-red-500/40 bg-red-500/10' : 'border-border bg-card hover:bg-muted/30'}`}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <p className="text-xs text-muted-foreground">Past</p>
          </div>
          <p className="text-xl font-bold text-red-400">{counts.past}</p>
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded-lg border p-3 text-left transition-colors ${statusFilter === 'all' ? 'border-primary/40 bg-primary/10' : 'border-border bg-card hover:bg-muted/30'}`}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <p className="text-xl font-bold text-foreground">{counts.total}</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReservationStatus | 'all')}
          className="rounded-lg border border-border bg-card px-4 py-2 text-foreground focus:border-ring focus:outline-none"
        >
          <option value="all">All ({counts.total})</option>
          <option value="today">Today ({counts.today})</option>
          <option value="upcoming">Upcoming ({counts.upcoming})</option>
          <option value="past">Past ({counts.past})</option>
        </select>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500/20 border border-red-500/30" />
          Red = Past
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-500/20 border border-green-500/30" />
          Green = Today
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/20 border border-blue-500/30" />
          Blue = Upcoming
        </div>
      </div>

      {/* Reservations List */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading from reservation form...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm text-error">Failed to load reservations. Check connection.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2" />
            <p>No reservations found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
              <div>Guest</div>
              <div>Date & Time</div>
              <div>Guests</div>
              <div>Status</div>
              <div>Details</div>
            </div>
            {filtered.map((reservation, idx) => {
              const key = `${reservation.dateOfReservation}-${reservation.phone}-${reservation.name}-${idx}`;
              const cfg = statusConfig[reservation.status];
              const isExpanded = expandedRow === key;
              return (
                <ReservationRow
                  key={key}
                  reservation={reservation}
                  cfg={cfg}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedRow(isExpanded ? null : key)}
                />
              );
            })}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {reservations.length} reservations
        </p>
      )}
    </div>
  );
}

interface RowProps {
  reservation: CsvReservation;
  cfg: typeof statusConfig[ReservationStatus];
  isExpanded: boolean;
  onToggle: () => void;
}

function ReservationRow({ reservation: r, cfg, isExpanded, onToggle }: RowProps) {
  return (
    <div className={`${cfg.bgColor} border-l-4 ${cfg.borderColor} transition-colors`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:brightness-95 transition-all"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Name + Status badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor} shrink-0`} />
              <h3 className="font-medium text-foreground text-sm truncate">
                {r.name || 'Unknown Guest'}
              </h3>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cfg.textColor} ${cfg.bgColor} border ${cfg.borderColor}`}>
                {cfg.label}
              </span>
              {r.specialPackages && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20 text-warning">
                  {r.specialPackages}
                </span>
              )}
            </div>

            {/* Key info row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {r.dateRaw || r.dateOfReservation}
              </span>
              {r.time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {r.time}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {r.numberOfGuests} {r.numberOfGuests === 1 ? 'guest' : 'guests'}
              </span>
              {r.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {r.phone}
                </span>
              )}
            </div>

            {/* Special requests preview */}
            {r.specialRequests && !isExpanded && (
              <p className="text-xs text-muted-foreground mt-1.5 truncate max-w-md italic">
                📝 {r.specialRequests}
              </p>
            )}
          </div>

          <div className="shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border/40">
          <div className="pt-3 grid gap-2 sm:grid-cols-2 text-sm">
            {r.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <a href={`mailto:${r.email}`} className="hover:text-foreground truncate">{r.email}</a>
              </div>
            )}
            {r.table && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xs">🪑</span>
                <span>Table: {r.table}</span>
              </div>
            )}
            {r.notes && r.notes.trim() && (
              <div className="sm:col-span-2 text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Notes: </span>
                {r.notes}
              </div>
            )}
            {r.specialRequests && (
              <div className="sm:col-span-2 text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Special Requests: </span>
                {r.specialRequests}
              </div>
            )}
            {r.occasion && (
              <div className="text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Occasion: </span>
                {r.occasion}
              </div>
            )}
            {r.mustHaves && r.mustHaves.trim() && (
              <div className="text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Must Haves: </span>
                {r.mustHaves}
              </div>
            )}
            {r.submittedAt && (
              <div className="sm:col-span-2 text-xs text-muted-foreground/60">
                Submitted: {new Date(r.submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
