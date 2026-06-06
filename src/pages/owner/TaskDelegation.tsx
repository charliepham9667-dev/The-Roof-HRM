import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ListTodo, 
  Plus, 
  User, 
  Calendar, 
  AlertCircle,
  CheckCircle,
  Circle,
  Loader2,
  MoreVertical,
  ChevronDown,
  X,
  PlayCircle
} from 'lucide-react';
import { 
  useAllDelegationTasks, 
  useCreateDelegationTask,
  useUpdateTaskStatus,
  useDeleteDelegationTask,
  useTaskStats
} from '../../hooks/useDelegationTasks';
import { useStaffList } from '../../hooks/useShifts';
import type { DelegationTask, TaskStatus, TaskPriority, TaskCategory, CreateDelegationTaskInput } from '../../types';
import { TaskDescriptionEditor, TaskDescriptionDisplay, SubTodoListEditor, SubTodoListDisplay } from '../../components/tasks';

const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string; icon: any }> = {
  todo: { label: 'To Do', color: 'text-muted-foreground', bg: 'bg-muted', icon: Circle },
  in_progress: { label: 'In Progress', color: 'text-info', bg: 'bg-info/20', icon: PlayCircle },
  done: { label: 'Done', color: 'text-success', bg: 'bg-success/20', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: X },
  blocked: { label: 'Blocked', color: 'text-error', bg: 'bg-error/20', icon: AlertCircle },
};

const priorityConfig: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted' },
  medium: { label: 'Medium', color: 'text-info', bg: 'bg-info/20' },
  high: { label: 'High', color: 'text-warning', bg: 'bg-warning/20' },
  urgent: { label: 'Urgent', color: 'text-error', bg: 'bg-error/20' },
};

const categoryOptions: { value: TaskCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'operations', label: 'Operations' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'event', label: 'Event' },
];

export function TaskDelegation() {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active');
  const [viewTask, setViewTask] = useState<DelegationTask | null>(null);
  
  const statusFilter = filter === 'active' 
    ? ['todo', 'in_progress', 'blocked'] as TaskStatus[]
    : filter === 'done' 
    ? ['done', 'cancelled'] as TaskStatus[]
    : undefined;

  const { data: tasks, isLoading } = useAllDelegationTasks(statusFilter);
  const { data: stats } = useTaskStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 min-w-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-foreground">Task Delegation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign and track tasks for your team
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="w-full shrink-0 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground">To Do</p>
          <p className="text-2xl font-bold text-muted-foreground">{stats?.todo || 0}</p>
        </div>
        <div className="rounded-lg bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground">In Progress</p>
          <p className="text-2xl font-bold text-info">{stats?.inProgress || 0}</p>
        </div>
        <div className="rounded-lg bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-success">{stats?.done || 0}</p>
        </div>
        <div className="rounded-lg bg-card border border-warning/30 p-4">
          <p className="text-xs text-muted-foreground">Urgent</p>
          <p className="text-2xl font-bold text-warning">{stats?.urgent || 0}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex rounded-lg bg-card border border-border p-1 w-fit">
        {(['active', 'done', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-control px-4 py-2 text-sm font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !tasks?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ListTodo className="h-8 w-8 mb-2" />
            <p>No tasks found</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Create your first task
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onView={() => setViewTask(task)} />
            ))}
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <TaskForm onClose={() => setShowForm(false)} />
      )}

      {/* Task detail sheet */}
      {viewTask && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setViewTask(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-xl overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold text-foreground">{viewTask.title}</h2>
              <button
                onClick={() => setViewTask(null)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {viewTask.description && (
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">Description</div>
                <TaskDescriptionDisplay description={viewTask.description} />
              </div>
            )}
            {viewTask.subTodos && viewTask.subTodos.length > 0 && (
              <SubTodoListDisplay
                items={viewTask.subTodos}
                onToggle={() => {}}
                disabled
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onView }: { task: DelegationTask; onView: () => void }) {
  const [showActions, setShowActions] = useState(false);
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteDelegationTask();

  const status = statusConfig[task.status];
  const priority = priorityConfig[task.priority];
  const StatusIcon = status.icon;

  const handleStatusChange = (newStatus: TaskStatus) => {
    updateStatus.mutate({ id: task.id, status: newStatus });
    setShowActions(false);
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  return (
    <div className={`p-4 ${isOverdue ? 'bg-error/5' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Status Icon */}
          <button
            onClick={() => {
              if (task.status === 'todo') handleStatusChange('in_progress');
              else if (task.status === 'in_progress') handleStatusChange('done');
            }}
            className={`flex-shrink-0 mt-0.5 rounded-full p-1 ${status.bg} hover:opacity-80 transition-opacity`}
          >
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {task.title}
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${priority.bg} ${priority.color}`}>
                {priority.label}
              </span>
              {isOverdue && (
                <span className="rounded-full bg-error/20 px-2 py-0.5 text-xs text-error">
                  Overdue
                </span>
              )}
            </div>

            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.assignedToProfile?.fullName || 'Unassigned'}
              </span>
              {task.dueDate && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-error' : ''}`}>
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
                {task.category}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showActions && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
                <button
                  onClick={() => { onView(); setShowActions(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                >
                  <ListTodo className="h-4 w-4" />
                  View details
                </button>
                {task.status !== 'done' && (
                  <>
                    {task.status === 'todo' && (
                      <button
                        onClick={() => handleStatusChange('in_progress')}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                      >
                        <PlayCircle className="h-4 w-4 text-info" />
                        Start Task
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange('done')}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                    >
                      <CheckCircle className="h-4 w-4 text-success" />
                      Mark Done
                    </button>
                    <button
                      onClick={() => handleStatusChange('blocked')}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                    >
                      <AlertCircle className="h-4 w-4 text-error" />
                      Mark Blocked
                    </button>
                  </>
                )}
                <hr className="my-1 border-border" />
                <button
                  onClick={() => {
                    deleteTask.mutate(task.id);
                    setShowActions(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error hover:bg-error/10 text-left"
                >
                  <X className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState<CreateDelegationTaskInput>({
    title: '',
    description: '',
    subTodos: [],
    assignedTo: '',
    dueDate: '',
    priority: 'medium',
    category: 'general',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: staffList } = useStaffList();
  const createTask = useCreateDelegationTask();

  // Filter to managers only for delegation
  const managers = staffList?.filter(s => s.role === 'manager' || s.role === 'owner') || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Task title is required');
      return;
    }
    if (!formData.assignedTo) {
      setError('Please select an assignee');
      return;
    }

    try {
      await createTask.mutateAsync(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">New Task</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <TaskDescriptionEditor
              value={formData.description || ''}
              onChange={(v) => setFormData(f => ({ ...f, description: v }))}
              placeholder="Additional details..."
            />
          </div>

          {/* Sub-tasks */}
          <SubTodoListEditor
            items={formData.subTodos ?? []}
            onChange={(items) => setFormData(f => ({ ...f, subTodos: items }))}
            disabled={createTask.isPending}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Assign To *
              </label>
              <div className="relative">
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData(f => ({ ...f, assignedTo: e.target.value }))}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
                  required
                >
                  <option value="">Select person...</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Priority
              </label>
              <div className="relative">
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
                >
                  {Object.entries(priorityConfig).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Category
              </label>
              <div className="relative">
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(f => ({ ...f, category: e.target.value as TaskCategory }))}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium h-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTask.isPending}
              className="px-4 py-2 text-sm font-medium h-auto"
            >
              {createTask.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
