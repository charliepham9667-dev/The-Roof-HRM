import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  ArrowUpCircle,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import {
  useManagerTasks,
  useManagerCompletedTasks,
  useUpdateTaskStatus,
  useCreateDelegationTask,
} from '@/hooks/useDelegationTasks';
import type { DelegationTask, TaskStatus, TaskPriority, CreateDelegationTaskInput } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TaskDescriptionDisplay, SubTodoListDisplay } from '@/components/tasks';
import { useUpdateDelegationTask } from '@/hooks/useDelegationTasks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── helpers ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'from_owner' | 'my_tasks' | 'high_priority' | 'completed';

function priorityColor(p: TaskPriority) {
  switch (p) {
    case 'urgent':
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-amber-600';
    default:
      return 'text-muted-foreground';
  }
}

function priorityLabel(p: TaskPriority) {
  return p.toUpperCase();
}

function isOverdue(task: DelegationTask) {
  if (!task.dueDate) return false;
  const due = new Date(`${task.dueDate}T${task.dueTime || '23:59'}`);
  return due < new Date() && task.status !== 'done' && task.status !== 'cancelled';
}

function formatDue(task: DelegationTask) {
  if (!task.dueDate) return null;
  const today = format(new Date(), 'yyyy-MM-dd');
  const label = task.dueDate === today ? 'Due today' : `Due ${format(new Date(task.dueDate), 'MMM d')}`;
  const time = task.dueTime ? ` · ${task.dueTime.slice(0, 5)}` : '';
  return label + time;
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface TaskRowProps {
  task: DelegationTask;
  myId: string;
  onToggleDone: (task: DelegationTask) => void;
  onEscalate: (task: DelegationTask) => void;
  onEdit: (task: DelegationTask) => void;
  onView: (task: DelegationTask) => void;
}

function TaskRow({ task, myId, onToggleDone, onEscalate, onEdit, onView }: TaskRowProps) {
  const isDone = task.status === 'done';
  const fromOwner = task.assignedBy !== myId;
  const overdue = isOverdue(task);
  const dueLabel = formatDue(task);

  return (
    <div className={`flex items-center gap-3 py-2 px-1 border-b border-border/50 last:border-0 min-h-[52px] ${isDone ? 'opacity-60' : ''}`}>
      <button
        className="shrink-0 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-primary transition-colors"
        onClick={() => onToggleDone(task)}
        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
      >
        {isDone ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onView(task)}
          className="text-left w-full hover:opacity-80 transition-opacity"
        >
          <p className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className={`text-[10px] font-bold tracking-wide ${priorityColor(task.priority)}`}>
            {priorityLabel(task.priority)}
          </span>
          {fromOwner && task.assignedByProfile && (
            <span className="rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              FROM {task.assignedByProfile.fullName?.split(' ')[0] ?? 'OWNER'}
            </span>
          )}
          {!fromOwner && (
            <span className="rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              MY TASK
            </span>
          )}
          {isDone && task.completedAt && (
            <span className="text-[10px] text-muted-foreground">
              Completed {format(new Date(task.completedAt), 'HH:mm')}
            </span>
          )}
          {!isDone && dueLabel && (
            <span className={`text-[10px] ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
              {dueLabel}
              {overdue && ' · overdue'}
            </span>
          )}
        </div>
      </div>

      {!isDone && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
          {fromOwner && (
            <button
              onClick={() => onEscalate(task)}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[36px]"
            >
              <ArrowUpCircle className="h-3 w-3" />
              Escalate
            </button>
          )}
          {!fromOwner && (
            <button
              onClick={() => onEdit(task)}
              className="rounded-md border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[36px]"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Task Dialog ─────────────────────────────────────────────────────────

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  myId: string;
}

function AddTaskDialog({ open, onClose, myId }: AddTaskDialogProps) {
  const createTask = useCreateDelegationTask();
  const [draft, setDraft] = useState<{
    title: string;
    description: string;
    dueDate: string;
    dueTime: string;
    priority: TaskPriority;
  }>({ title: '', description: '', dueDate: '', dueTime: '', priority: 'medium' });

  const handleSave = async () => {
    if (!draft.title.trim()) return;
    const input: CreateDelegationTaskInput = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      assignedTo: myId,
      dueDate: draft.dueDate || undefined,
      dueTime: draft.dueTime || undefined,
      priority: draft.priority,
    };
    await createTask.mutateAsync(input);
    setDraft({ title: '', description: '', dueDate: '', dueTime: '', priority: 'medium' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder="Task title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <textarea
            placeholder="Description (optional)"
            rows={2}
            value={draft.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft((d) => ({ ...d, description: e.target.value }))}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
              className="flex-1"
            />
            <Input
              type="time"
              value={draft.dueTime}
              onChange={(e) => setDraft((d) => ({ ...d, dueTime: e.target.value }))}
              className="flex-1"
            />
          </div>
          <Select
            value={draft.priority}
            onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as TaskPriority }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!draft.title.trim() || createTask.isPending}>
            {createTask.isPending ? 'Adding…' : 'Add Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ManagerMyTasks() {
  const profile = useAuthStore((s) => s.profile);
  const myId = profile?.id ?? '';

  const { data: activeTasks = [], isLoading, isError } = useManagerTasks(['todo', 'in_progress', 'blocked']);
  const { data: completedTasks = [] } = useManagerCompletedTasks();
  const updateStatus = useUpdateTaskStatus();
  const updateTask = useUpdateDelegationTask();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [escalateTask, setEscalateTask] = useState<DelegationTask | null>(null);
  const [viewTask, setViewTask] = useState<DelegationTask | null>(null);

  const today = format(new Date(), 'EEEE, d MMM');

  // Categorise active tasks
  const fromOwner = useMemo(() => activeTasks.filter((t) => t.assignedBy !== myId), [activeTasks, myId]);
  const myOwn = useMemo(() => activeTasks.filter((t) => t.assignedBy === myId), [activeTasks, myId]);
  const highPriority = useMemo(
    () => activeTasks.filter((t) => t.priority === 'high' || t.priority === 'urgent'),
    [activeTasks]
  );
  const doneToday = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return completedTasks.filter((t) => t.completedAt?.startsWith(todayStr));
  }, [completedTasks]);

  // Stat card counts
  const stats = [
    { label: 'PENDING', value: activeTasks.length, sub: 'Need action today', color: 'text-foreground' },
    { label: 'FROM OWNER', value: fromOwner.length, sub: 'Delegated to you', color: 'text-amber-600' },
    { label: 'MY OWN', value: myOwn.length, sub: 'Self-assigned', color: 'text-blue-600' },
    { label: 'DONE TODAY', value: doneToday.length, sub: 'Completed this shift', color: 'text-emerald-600' },
  ];

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'from_owner', label: 'From Owner' },
    { id: 'my_tasks', label: 'My Tasks' },
    { id: 'high_priority', label: 'High Priority' },
    { id: 'completed', label: 'Completed' },
  ];

  const pendingFiltered = useMemo(() => {
    switch (activeTab) {
      case 'from_owner': return fromOwner;
      case 'my_tasks': return myOwn;
      case 'high_priority': return highPriority;
      case 'completed': return [];
      default: return activeTasks;
    }
  }, [activeTab, activeTasks, fromOwner, myOwn, highPriority]);

  const completedFiltered = useMemo(() => {
    if (activeTab === 'completed') return doneToday;
    if (activeTab === 'all') return doneToday;
    return [];
  }, [activeTab, doneToday]);

  const handleToggleDone = async (task: DelegationTask) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    await updateStatus.mutateAsync({ id: task.id, status: newStatus });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-foreground">My Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {today} · {activeTasks.length} pending · {doneToday.length} completed today
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

      {/* Filter tabs + Add button */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-1 min-w-0">
          <div className="flex overflow-x-auto pb-1 gap-2 scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 min-h-[36px] text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Right-edge fade hint */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent" />
        </div>
        <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Task
        </Button>
      </div>

      {/* Task board */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Task Board</span>
          <span className="text-xs text-muted-foreground">
            {pendingFiltered.length + completedFiltered.length} tasks · {pendingFiltered.length} pending
          </span>
        </div>

        {isError ? (
          <div className="py-12 text-center text-sm text-muted-foreground">⚠️ Unable to load tasks. Please refresh.</div>
        ) : isLoading ? (
          <div className="px-4 divide-y divide-border/50">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 py-3 px-1">
                <Skeleton className="mt-0.5 h-4 w-4 rounded shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3.5 w-10 rounded" />
                    <Skeleton className="h-3.5 w-16 rounded" />
                  </div>
                </div>
                <Skeleton className="h-6 w-10 rounded-md shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4">
            {/* Pending group */}
            {pendingFiltered.length > 0 && (
              <>
                <div className="py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Pending — {pendingFiltered.length}
                </div>
                {pendingFiltered.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    myId={myId}
                    onToggleDone={handleToggleDone}
                    onEscalate={(t) => setEscalateTask(t)}
                    onEdit={() => {}}
                    onView={(t) => setViewTask(t)}
                  />
                ))}
              </>
            )}

            {/* Completed today group */}
            {completedFiltered.length > 0 && (
              <>
                <button
                  className="w-full flex items-center justify-between py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
                  onClick={() => setShowCompleted((v) => !v)}
                >
                  <span>Completed Today — {completedFiltered.length}</span>
                  {showCompleted ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showCompleted &&
                  completedFiltered.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      myId={myId}
                      onToggleDone={handleToggleDone}
                      onEscalate={() => {}}
                      onEdit={() => {}}
                      onView={(t) => setViewTask(t)}
                    />
                  ))}
              </>
            )}

            {pendingFiltered.length === 0 && completedFiltered.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No tasks in this view.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add task dialog */}
      <AddTaskDialog open={addOpen} onClose={() => setAddOpen(false)} myId={myId} />

      {/* Task detail sheet */}
      <Sheet open={!!viewTask} onOpenChange={(v) => !v && setViewTask(null)}>
        <SheetContent side="right" className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          {viewTask && (
            <div className="space-y-4 py-2">
              <h2 className="text-lg font-semibold text-foreground">{viewTask.title}</h2>
              {viewTask.description && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Description</div>
                  <TaskDescriptionDisplay description={viewTask.description} />
                </div>
              )}
              {viewTask.subTodos && viewTask.subTodos.length > 0 && (
                <SubTodoListDisplay
                  items={viewTask.subTodos}
                  disabled={updateTask.isPending}
                  onToggle={(id, completed) => {
                    const next = viewTask.subTodos!.map((t) =>
                      t.id === id ? { ...t, completed } : t
                    );
                    setViewTask((t) => t ? { ...t, subTodos: next } : null);
                    updateTask.mutate({ id: viewTask.id, subTodos: next });
                  }}
                />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Escalate confirmation dialog */}
      <Dialog open={!!escalateTask} onOpenChange={(v) => !v && setEscalateTask(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-amber-500" />
              Escalate Task
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Mark <span className="font-medium text-foreground">"{escalateTask?.title}"</span> as escalated? This will notify the owner.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateTask(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!escalateTask) return;
                await updateStatus.mutateAsync({ id: escalateTask.id, status: 'blocked' });
                setEscalateTask(null);
              }}
            >
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ManagerMyTasks;
