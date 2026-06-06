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
  MapPin,
  Star,
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

  // Group filtered into today / upcoming / past for the grouped mobile view
  const todayList = filtered.filter((r) => r.status === 'today');
  const upcomingList = filtered.filter((r) => r.status === 'upcoming');
  const pastList = filtered.filter((r) => r.status === 'past');

  return (
    <div className="space-y-5">
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
          className="flex shrink-0 whitespace-nowrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, phone, email, or date..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none text-sm"
        />
      </div>

      {/* Status filter pills — mobile friendly */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['all', 'today', 'upcoming', 'past'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize ${
              statusFilter === s
                ? s === 'today' ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : s === 'upcoming' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : s === 'past' ? 'bg-red-500/20 border-red-500/40 text-red-400'
                  : 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'all' ? `All (${counts.total})` : s === 'today' ? `Today (${counts.today})` : s === 'upcoming' ? `Upcoming (${counts.upcoming})` : `Past (${counts.past})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading reservations...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm text-error">Failed to load reservations. Check connection.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Calendar className="h-8 w-8 mb-2" />
          <p>No reservations found</p>
        </div>
      ) : (
        <>
          {/* ── MOBILE: grouped list view ── */}
          <div className="flex flex-col gap-6 md:hidden">
            {/* TODAY section */}
            {todayList.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400 ring-4 ring-green-400/20" />
                  <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-green-400">
                    Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 h-px bg-green-500/20" />
                  <span className="shrink-0 text-xs text-green-400/70">{todayPax} guests</span>
                </div>
                <div className="flex flex-col gap-2">
                  {todayList.map((r, idx) => {
                    const key = `today-${r.phone}-${r.name}-${idx}`;
                    return (
                      <MobileReservationCard
                        key={key}
                        reservation={r}
                        cfg={statusConfig[r.status]}
                        isExpanded={expandedRow === key}
                        onToggle={() => setExpandedRow(expandedRow === key ? null : key)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* UPCOMING section */}
            {upcomingList.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400 ring-4 ring-blue-400/20" />
                  <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-blue-400">
                    Upcoming
                  </span>
                  <div className="flex-1 h-px bg-blue-500/20" />
                  <span className="shrink-0 text-xs text-blue-400/70">{upcomingPax} guests</span>
                </div>
                <div className="flex flex-col gap-2">
                  {upcomingList.map((r, idx) => {
                    const key = `upcoming-${r.phone}-${r.name}-${idx}`;
                    return (
                      <MobileReservationCard
                        key={key}
                        reservation={r}
                        cfg={statusConfig[r.status]}
                        isExpanded={expandedRow === key}
                        onToggle={() => setExpandedRow(expandedRow === key ? null : key)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* PAST section — collapsed by default, show only when filtered */}
            {pastList.length > 0 && statusFilter !== 'upcoming' && statusFilter !== 'today' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400/60" />
                  <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-red-400/70">
                    Past
                  </span>
                  <div className="flex-1 h-px bg-red-500/20" />
                  <span className="shrink-0 text-xs text-red-400/50">{pastList.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {pastList.map((r, idx) => {
                    const key = `past-${r.phone}-${r.name}-${idx}`;
                    return (
                      <MobileReservationCard
                        key={key}
                        reservation={r}
                        cfg={statusConfig[r.status]}
                        isExpanded={expandedRow === key}
                        onToggle={() => setExpandedRow(expandedRow === key ? null : key)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── DESKTOP: existing table-style list ── */}
          <div className="hidden md:block rounded-card border border-border bg-card overflow-hidden shadow-card">
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                <div>Guest</div>
                <div>Date & Time</div>
                <div>Guests</div>
                <div>Status</div>
                <div>Details</div>
              </div>
              {filtered.map((reservation, idx) => {
                const key = `desktop-${reservation.dateOfReservation}-${reservation.phone}-${reservation.name}-${idx}`;
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
          </div>

          <p className="text-xs text-muted-foreground text-right">
            Showing {filtered.length} of {reservations.length} reservations
          </p>
        </>
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

// ── Mobile card component ────────────────────────────────────────────────────
function MobileReservationCard({ reservation: r, cfg, isExpanded, onToggle }: RowProps) {
  return (
    <div className={`rounded-xl border ${cfg.borderColor} ${cfg.bgColor} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3.5"
      >
        <div className="flex items-start justify-between gap-3">
          {/* Time pill — prominent on mobile */}
          <div className={`shrink-0 flex flex-col items-center justify-center rounded-lg px-2.5 py-2 min-w-[52px] ${cfg.bgColor} border ${cfg.borderColor}`}>
            {r.time ? (
              <>
                <Clock className={`h-3 w-3 ${cfg.textColor} mb-0.5`} />
                <span className={`text-xs font-bold leading-none ${cfg.textColor}`}>{r.time}</span>
              </>
            ) : (
              <Calendar className={`h-4 w-4 ${cfg.textColor}`} />
            )}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate">
                {r.name || 'Unknown Guest'}
              </span>
              {r.specialPackages && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning">
                  <Star className="h-2.5 w-2.5" />
                  {r.specialPackages}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span className="font-medium text-foreground">{r.numberOfGuests}</span> guests
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {r.dateRaw || r.dateOfReservation}
              </span>
              {r.table && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {r.table}
                </span>
              )}
            </div>

            {r.phone && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <a href={`tel:${r.phone}`} className="hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                  {r.phone}
                </a>
              </div>
            )}

            {r.specialRequests && !isExpanded && (
              <p className="mt-1.5 text-xs text-muted-foreground italic truncate">
                📝 {r.specialRequests}
              </p>
            )}
          </div>

          <div className={`shrink-0 mt-0.5 ${cfg.textColor}`}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className={`px-4 pb-4 pt-2 border-t ${cfg.borderColor} space-y-2`}>
          {r.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <a href={`mailto:${r.email}`} className="hover:text-foreground truncate">{r.email}</a>
            </div>
          )}
          {r.occasion && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Occasion: </span>{r.occasion}
            </div>
          )}
          {r.specialRequests && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Special Requests: </span>{r.specialRequests}
            </div>
          )}
          {r.mustHaves && r.mustHaves.trim() && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Must Haves: </span>{r.mustHaves}
            </div>
          )}
          {r.notes && r.notes.trim() && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Notes: </span>{r.notes}
            </div>
          )}
          {r.submittedAt && (
            <div className="text-[11px] text-muted-foreground/50 pt-1">
              Submitted: {new Date(r.submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
