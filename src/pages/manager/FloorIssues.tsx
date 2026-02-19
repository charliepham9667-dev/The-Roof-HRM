import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Star,
  Wrench,
  UserX,
  Instagram,
  ShieldAlert,
  ArrowUpCircle,
  CheckCircle2,
  X,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import {
  useMaintenanceTasks,
  useCreateMaintenanceTask,
  useUpdateMaintenanceTask,
  type MaintenanceTask,
  type MaintenanceCategory,
} from '@/hooks/useMaintenanceTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Quick-log categories ────────────────────────────────────────────────────

interface QuickCategory {
  label: string;
  sub: string;
  icon: React.ElementType;
  category: MaintenanceCategory;
  escalate?: boolean;
}

const QUICK_CATEGORIES: QuickCategory[] = [
  { label: 'Guest Complaint', sub: 'Service, quality, noise', icon: AlertTriangle, category: 'other' },
  { label: 'VIP Arrival', sub: 'Note table & needs', icon: Star, category: 'other' },
  { label: 'Technical Issue', sub: 'Equipment, sound, lights', icon: Wrench, category: 'equipment' },
  { label: 'Staff Issue', sub: 'Behaviour, attendance', icon: UserX, category: 'other' },
  { label: 'Influencer Visit', sub: 'Tag for marketing', icon: Instagram, category: 'other' },
  { label: 'Security Issue', sub: 'Escalates immediately', icon: ShieldAlert, category: 'safety', escalate: true },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case 'open':
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 text-[10px] font-bold uppercase">● OPEN</span>;
    case 'in_progress':
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase">● NOTED</span>;
    case 'done':
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase">● RESOLVED</span>;
    default:
      return null;
  }
}

function categoryTag(category: MaintenanceCategory) {
  const map: Record<string, string> = {
    equipment: 'TECHNICAL ISSUE',
    safety: 'SECURITY ISSUE',
    electrical: 'ELECTRICAL',
    plumbing: 'PLUMBING',
    structural: 'STRUCTURAL',
    aesthetic: 'AESTHETIC',
    other: 'NOTE',
  };
  const colors: Record<string, string> = {
    equipment: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    safety: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    other: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  };
  const color = colors[category] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {map[category] ?? category.toUpperCase()}
    </span>
  );
}

// ─── Log Issue Dialog ─────────────────────────────────────────────────────────

interface LogIssueDialogProps {
  open: boolean;
  presetCategory?: MaintenanceCategory;
  onClose: () => void;
}

function LogIssueDialog({ open, presetCategory, onClose }: LogIssueDialogProps) {
  const createTask = useCreateMaintenanceTask();
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    category: presetCategory ?? ('other' as MaintenanceCategory),
    priority: 'medium' as 'low' | 'medium' | 'high',
    location: '',
  });

  // Sync preset category when dialog opens with a preset
  const effectiveCategory = presetCategory ?? draft.category;

  const handleSave = async () => {
    if (!draft.title.trim()) return;
    await createTask.mutateAsync({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      category: effectiveCategory,
      priority: draft.priority,
      location: draft.location.trim() || null,
      status: 'open',
    });
    setDraft({ title: '', description: '', category: 'other', priority: 'medium', location: '' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Floor Issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder="Issue title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <textarea
            placeholder="Details (optional)"
            rows={3}
            value={draft.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft((d) => ({ ...d, description: e.target.value }))}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <Input
            placeholder="Location (e.g. Table 5, Rooftop bar)"
            value={draft.location}
            onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
          />
          {!presetCategory && (
            <Select
              value={draft.category}
              onValueChange={(v) => setDraft((d) => ({ ...d, category: v as MaintenanceCategory }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="other">General / Guest</SelectItem>
                <SelectItem value="equipment">Equipment / Technical</SelectItem>
                <SelectItem value="safety">Security / Safety</SelectItem>
                <SelectItem value="electrical">Electrical</SelectItem>
                <SelectItem value="plumbing">Plumbing</SelectItem>
                <SelectItem value="structural">Structural</SelectItem>
                <SelectItem value="aesthetic">Aesthetic</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select
            value={draft.priority}
            onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as 'low' | 'medium' | 'high' }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!draft.title.trim() || createTask.isPending}>
            {createTask.isPending ? 'Logging…' : 'Log Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Issue Row ────────────────────────────────────────────────────────────────

interface IssueRowProps {
  task: MaintenanceTask;
  myName: string;
  onEscalate: () => void;
  onResolve: () => void;
  onClose: () => void;
}

function IssueRow({ task, myName, onEscalate, onResolve, onClose }: IssueRowProps) {
  const loggedAt = format(new Date(task.createdAt), 'HH:mm');
  const isResolved = task.status === 'done';

  return (
    <div className="py-4 border-b border-border/50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {statusBadge(task.status)}
            <span className="text-[10px] text-muted-foreground">
              Logged {loggedAt} by {myName}
            </span>
            {categoryTag(task.category)}
          </div>
        </div>
        {!isResolved && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {task.status === 'open' && (
              <button
                onClick={onEscalate}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                <ArrowUpCircle className="h-3 w-3" />
                Escalate to Charlie
              </button>
            )}
            <button
              onClick={onResolve}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="h-3 w-3" />
              Mark Resolved
            </button>
          </div>
        )}
        {isResolved && (
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" />
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FloorIssues() {
  const profile = useAuthStore((s) => s.profile);
  const myName = profile?.fullName?.split(' ')[0] ?? 'Me';

  const { data: tasks = [], isLoading } = useMaintenanceTasks();
  const updateTask = useUpdateMaintenanceTask();

  const [logOpen, setLogOpen] = useState(false);
  const [presetCategory, setPresetCategory] = useState<MaintenanceCategory | undefined>();

  const openLog = useMemo(() => tasks.filter((t) => t.status === 'open'), [tasks]);
  const escalated = useMemo(() => tasks.filter((t) => t.status === 'in_progress'), [tasks]);
  const resolved = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks]);

  const stats = [
    { label: 'OPEN', value: openLog.length, sub: 'Needs resolution', color: 'text-red-600' },
    { label: 'ESCALATED', value: escalated.length, sub: 'Charlie notified', color: 'text-amber-600' },
    { label: 'RESOLVED', value: resolved.length, sub: 'Tonight', color: 'text-emerald-600' },
    { label: 'TOTAL LOGGED', value: tasks.length, sub: 'This shift', color: 'text-foreground' },
  ];

  const handleQuickLog = (cat: QuickCategory) => {
    setPresetCategory(cat.category);
    setLogOpen(true);
  };

  const handleEscalate = async (task: MaintenanceTask) => {
    await updateTask.mutateAsync({ id: task.id, status: 'in_progress' });
  };

  const handleResolve = async (task: MaintenanceTask) => {
    await updateTask.mutateAsync({ id: task.id, status: 'done' });
  };

  const handleClose = async (task: MaintenanceTask) => {
    await updateTask.mutateAsync({ id: task.id, status: 'done' });
  };

  // Tonight's log = all tasks sorted newest first
  const tonightLog = useMemo(
    () => [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tasks]
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Floor Issues</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log anything that happens on the floor. Open issues escalate to Charlie automatically after 30 min.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick log */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quick Log</span>
          <span className="text-xs text-muted-foreground">Tap to log an issue</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
          {QUICK_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => handleQuickLog(cat)}
                className="flex items-center gap-3 bg-card px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <Icon className={`h-5 w-5 shrink-0 ${cat.escalate ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium text-foreground leading-tight">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground">{cat.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tonight's log */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tonight's Log</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{tonightLog.length} entries</span>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => { setPresetCategory(undefined); setLogOpen(true); }}>
              <Plus className="h-3 w-3" />
              Log Issue
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : tonightLog.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No issues logged tonight. Nice shift!</div>
        ) : (
          <div className="px-4">
            {tonightLog.map((task) => (
              <IssueRow
                key={task.id}
                task={task}
                myName={myName}
                onEscalate={() => handleEscalate(task)}
                onResolve={() => handleResolve(task)}
                onClose={() => handleClose(task)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Log issue dialog */}
      <LogIssueDialog
        open={logOpen}
        presetCategory={presetCategory}
        onClose={() => { setLogOpen(false); setPresetCategory(undefined); }}
      />
    </div>
  );
}

export default FloorIssues;
