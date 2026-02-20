import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, GripVertical, X, Check, Loader2, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTaskTemplates,
  useCreateTaskTemplate,
  useUpdateTaskTemplate,
  useDeleteTaskTemplate,
} from '../../hooks/useTasks';
import type { TaskTemplate, TaskTemplateType } from '../../types';

// ─── constants ───────────────────────────────────────────────────────────────

const TASK_TYPES: { value: TaskTemplateType; label: string }[] = [
  { value: 'opening', label: 'Opening' },
  { value: 'closing', label: 'Closing' },
  { value: 'midshift', label: 'Mid-Shift' },
  { value: 'event', label: 'Event' },
  { value: 'special', label: 'Special' },
];

const ALL_ROLES = ['all', 'service', 'bar', 'floor_manager', 'manager'];

const ROLE_LABELS: Record<string, string> = {
  all: 'All Staff',
  service: 'Service',
  bar: 'Bar',
  floor_manager: 'Floor Manager',
  manager: 'Manager',
};

const TYPE_COLORS: Record<TaskTemplateType, string> = {
  opening: 'border-amber-200 bg-amber-50 text-amber-700',
  closing: 'border-blue-200 bg-blue-50 text-blue-700',
  midshift: 'border-green-200 bg-green-50 text-green-700',
  event: 'border-purple-200 bg-purple-50 text-purple-700',
  special: 'border-pink-200 bg-pink-50 text-pink-700',
};

const TYPE_DOT: Record<TaskTemplateType, string> = {
  opening: 'bg-amber-500',
  closing: 'bg-blue-500',
  midshift: 'bg-green-500',
  event: 'bg-purple-500',
  special: 'bg-pink-500',
};

// ─── types ───────────────────────────────────────────────────────────────────

interface DraftTask {
  name: string;
  description: string;
  order: number;
  required: boolean;
  estimatedMinutes: string;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  taskType: TaskTemplateType;
  applicableRoles: string[];
  tasks: DraftTask[];
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    taskType: 'opening',
    applicableRoles: ['all'],
    tasks: [],
  };
}

function templateToForm(t: TaskTemplate): FormState {
  return {
    id: t.id,
    name: t.name,
    description: t.description || '',
    taskType: t.taskType,
    applicableRoles: t.applicableRoles,
    tasks: t.tasks.map((item) => ({
      name: item.name,
      description: item.description || '',
      order: item.order,
      required: item.required,
      estimatedMinutes: item.estimatedMinutes ? String(item.estimatedMinutes) : '',
    })),
  };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function RolePill({ role, active, onClick }: { role: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground'
      }`}
    >
      {ROLE_LABELS[role] ?? role}
    </button>
  );
}

function TaskItemRow({
  task,
  index,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  task: DraftTask;
  index: number;
  onUpdate: (field: keyof DraftTask, value: string | boolean) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex shrink-0 flex-col gap-0.5 pt-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <GripVertical className="h-4 w-4 text-border" />
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <input
          type="text"
          placeholder={`Task ${index + 1} name…`}
          value={task.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={task.description}
          onChange={(e) => onUpdate('description', e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={task.required}
              onChange={(e) => onUpdate('required', e.target.checked)}
              className="h-3.5 w-3.5 rounded"
            />
            Required
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              placeholder="mins"
              value={task.estimatedMinutes}
              onChange={(e) => onUpdate('estimatedMinutes', e.target.value)}
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-xs text-muted-foreground">est. min</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── modal/drawer form ────────────────────────────────────────────────────────

function TemplateForm({
  initial,
  onClose,
}: {
  initial: FormState;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState('');
  const create = useCreateTaskTemplate();
  const update = useUpdateTaskTemplate();
  const isSaving = create.isPending || update.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function toggleRole(role: string) {
    if (role === 'all') {
      set('applicableRoles', ['all']);
      return;
    }
    setForm((f) => {
      const without = f.applicableRoles.filter((r) => r !== 'all');
      const has = without.includes(role);
      const next = has ? without.filter((r) => r !== role) : [...without, role];
      return { ...f, applicableRoles: next.length === 0 ? ['all'] : next };
    });
  }

  function addTask() {
    setForm((f) => ({
      ...f,
      tasks: [
        ...f.tasks,
        { name: '', description: '', order: f.tasks.length + 1, required: true, estimatedMinutes: '' },
      ],
    }));
  }

  function updateTask(index: number, field: keyof DraftTask, value: string | boolean) {
    setForm((f) => {
      const tasks = [...f.tasks];
      tasks[index] = { ...tasks[index], [field]: value };
      return { ...f, tasks };
    });
  }

  function removeTask(index: number) {
    setForm((f) => {
      const tasks = f.tasks.filter((_, i) => i !== index).map((t, i) => ({ ...t, order: i + 1 }));
      return { ...f, tasks };
    });
  }

  function moveTask(index: number, direction: 'up' | 'down') {
    setForm((f) => {
      const tasks = [...f.tasks];
      const swap = direction === 'up' ? index - 1 : index + 1;
      [tasks[index], tasks[swap]] = [tasks[swap], tasks[index]];
      return { ...f, tasks: tasks.map((t, i) => ({ ...t, order: i + 1 })) };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Template name is required.'); return; }
    if (form.tasks.length === 0) { setError('Add at least one task item.'); return; }
    if (form.tasks.some((t) => !t.name.trim())) { setError('All task items need a name.'); return; }

    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      taskType: form.taskType,
      applicableRoles: form.applicableRoles,
      tasks: form.tasks.map((t, i) => ({
        name: t.name.trim(),
        description: t.description.trim() || undefined,
        order: i + 1,
        required: t.required,
        estimatedMinutes: t.estimatedMinutes ? parseInt(t.estimatedMinutes) : undefined,
      })),
    };

    try {
      if (form.id) {
        await update.mutateAsync({ id: form.id, isActive: true, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-[560px] flex-col bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {form.id ? 'Edit Checklist' : 'New Checklist'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define the template and task items
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Checklist Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Bar Opening Checklist"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </label>
            <textarea
              placeholder="Brief description of this checklist…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Checklist Type *
            </label>
            <div className="grid grid-cols-5 gap-2">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('taskType', t.value)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                    form.taskType === t.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Applicable roles */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Applicable Roles *
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <RolePill
                  key={role}
                  role={role}
                  active={form.applicableRoles.includes(role)}
                  onClick={() => toggleRole(role)}
                />
              ))}
            </div>
          </div>

          {/* Task items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Task Items *
              </label>
              <span className="text-xs text-muted-foreground">{form.tasks.length} item{form.tasks.length !== 1 ? 's' : ''}</span>
            </div>

            {form.tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
                <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No tasks yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">Add at least one task item below</p>
              </div>
            )}

            <div className="space-y-2">
              {form.tasks.map((task, i) => (
                <TaskItemRow
                  key={i}
                  task={task}
                  index={i}
                  onUpdate={(field, value) => updateTask(i, field, value)}
                  onRemove={() => removeTask(i)}
                  onMoveUp={() => moveTask(i, 'up')}
                  onMoveDown={() => moveTask(i, 'down')}
                  isFirst={i === 0}
                  isLast={i === form.tasks.length - 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addTask}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Add Task Item
            </button>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {form.id ? 'Save Changes' : 'Create Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onDelete: _onDelete,
}: {
  template: TaskTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTemplate = useDeleteTaskTemplate();

  async function handleDelete() {
    await deleteTemplate.mutateAsync(template.id);
    setConfirmDelete(false);
  }

  return (
    <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{template.name}</span>
            <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLORS[template.taskType]}`}>
              {template.taskType}
            </span>
          </div>
          {template.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {template.applicableRoles.map((r) => (
              <span key={r} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                {ROLE_LABELS[r] ?? r}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{template.tasks.length} task{template.tasks.length !== 1 ? 's' : ''}</span>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5">
              <span className="text-xs text-destructive">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={deleteTemplate.isPending}
                className="rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {deleteTemplate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded task list */}
      {expanded && (
        <div className="border-t border-border bg-secondary/30 px-5 py-3 space-y-1.5">
          {template.tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks in this template.</p>
          ) : (
            template.tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-[9px] font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-foreground">{task.name}</span>
                  {task.description && (
                    <span className="ml-2 text-xs text-muted-foreground">{task.description}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {task.required && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700 uppercase">req</span>
                  )}
                  {task.estimatedMinutes && (
                    <span className="text-[10px] text-muted-foreground">{task.estimatedMinutes}m</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export function ManageChecklists() {
  const [filterType, setFilterType] = useState<TaskTemplateType | 'all'>('all');
  const [formState, setFormState] = useState<FormState | null>(null);

  const { data: templates = [], isLoading } = useTaskTemplates();

  const filtered = filterType === 'all'
    ? templates
    : templates.filter((t) => t.taskType === filterType);

  const grouped = TASK_TYPES.reduce<Record<string, TaskTemplate[]>>((acc, t) => {
    acc[t.value] = filtered.filter((tmpl) => tmpl.taskType === t.value);
    return acc;
  }, {});

  const typesWithItems = filterType === 'all'
    ? TASK_TYPES.filter((t) => grouped[t.value].length > 0)
    : TASK_TYPES.filter((t) => t.value === filterType);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-foreground">Manage Checklists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and edit task templates assigned to staff by role and shift type
          </p>
        </div>
        <button
          onClick={() => setFormState(emptyForm())}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#78350F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6b2d0b] transition-colors"
        >
          <Plus className="h-4 w-4" />
          + New Checklist
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <button
          onClick={() => setFilterType('all')}
          className={cn(
            "shrink-0 rounded-full px-[14px] py-[6px] text-[13px] font-medium transition-all whitespace-nowrap",
            filterType === 'all'
              ? 'bg-[#78350F] text-white'
              : 'bg-white border border-[#D1D5DB] text-[#6B7280] hover:border-[#9CA3AF]'
          )}
        >
          All ({templates.length})
        </button>
        {TASK_TYPES.map((t) => {
          const count = templates.filter((tmpl) => tmpl.taskType === t.value).length;
          return (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={cn(
                "shrink-0 rounded-full px-[14px] py-[6px] text-[13px] font-medium transition-all whitespace-nowrap",
                filterType === t.value
                  ? 'bg-[#78350F] text-white'
                  : 'bg-white border border-[#D1D5DB] text-[#6B7280] hover:border-[#9CA3AF]'
              )}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border py-16 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No checklists yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create your first checklist template to get started</p>
          <button
            onClick={() => setFormState(emptyForm())}
            className="mt-4 flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-80"
          >
            <Plus className="h-4 w-4" />
            New Checklist
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">No checklists for this type</p>
        </div>
      ) : (
        <div className="space-y-6">
          {typesWithItems.map((type) => (
            <div key={type.value} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${TYPE_DOT[type.value]}`} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">{type.label}</span>
                <span className="rounded-full px-[7px] py-[1px] text-[11px] font-semibold bg-[#F3F4F6] text-[#6B7280]">{grouped[type.value].length}</span>
                <div className="h-px flex-1 bg-border ml-1" />
              </div>
              <div className="space-y-3">
                {grouped[type.value].map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={() => setFormState(templateToForm(template))}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-out form */}
      {formState && (
        <TemplateForm
          initial={formState}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
}
