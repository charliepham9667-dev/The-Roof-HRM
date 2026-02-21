import { useRef, useState } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  ListChecks,
  Loader2,
  AlertCircle,
  Camera,
  X,
  ZoomIn,
  Plus,
} from 'lucide-react';
import { useMyTaskTemplates, useTaskCompletion, useToggleTaskItem, useUploadTaskPhoto, useDeleteTaskPhoto } from '../../hooks/useTasks';
import type { CompletedTaskItem, TaskTemplate } from '../../types';

interface TaskChecklistProps {
  taskType?: 'opening' | 'closing' | 'midshift';
}

export function TaskChecklist({ taskType }: TaskChecklistProps) {
  const { data: templates, isLoading } = useMyTaskTemplates(taskType);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!templates?.length) {
    return (
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ListChecks className="h-8 w-8 mb-2" />
          <p>No checklists available for your role</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <TaskTemplateCard
          key={template.id}
          template={template}
          isExpanded={expandedId === template.id}
          onToggle={() => setExpandedId(expandedId === template.id ? null : template.id)}
        />
      ))}
    </div>
  );
}

interface TaskTemplateCardProps {
  template: TaskTemplate;
  isExpanded: boolean;
  onToggle: () => void;
}

function TaskTemplateCard({ template, isExpanded, onToggle }: TaskTemplateCardProps) {
  const { data: completion } = useTaskCompletion(template.id);
  const toggleTask = useToggleTaskItem();

  const completedTasks = completion?.completedTasks || [];
  const totalTasks = template.tasks.length;
  const completedCount = completedTasks.length;
  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const isComplete = completedCount === totalTasks;

  const handleToggleTask = (taskName: string) => {
    toggleTask.mutate({
      template,
      currentCompletedTasks: completedTasks,
      taskName,
    });
  };

  const isTaskCompleted = (taskName: string) => {
    return completedTasks.some(t => t.taskName === taskName);
  };

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      opening: { label: 'Opening', color: 'text-info' },
      closing: { label: 'Closing', color: 'text-purple-400' },
      midshift: { label: 'Mid-Shift', color: 'text-warning' },
      event: { label: 'Event', color: 'text-pink-400' },
      special: { label: 'Special', color: 'text-success' },
    };
    return labels[type] || { label: type, color: 'text-muted-foreground' };
  };

  const typeInfo = getTaskTypeLabel(template.taskType);

  return (
    <div className={`rounded-card border bg-card overflow-hidden shadow-card transition-colors ${
      isComplete ? 'border-success/30' : 'border-border'
    }`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${isComplete ? 'bg-success/20' : 'bg-muted'}`}>
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <ListChecks className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-medium text-foreground">{template.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {completedCount}/{totalTasks} tasks
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-2 bg-background rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  isComplete ? 'bg-success' : 'bg-primary'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={`text-sm font-medium ${isComplete ? 'text-success' : 'text-muted-foreground'}`}>
              {progress}%
            </span>
          </div>
          
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Tasks List */}
      {isExpanded && (
        <div className="border-t border-border p-4">
          <div className="space-y-2">
            {template.tasks.map((task, index) => {
              const completed = isTaskCompleted(task.name);
              const completedTask = completedTasks.find(t => t.taskName === task.name);

              return (
                <TaskItemRow
                  key={index}
                  taskName={task.name}
                  taskDescription={task.description}
                  estimatedMinutes={task.estimatedMinutes}
                  required={task.required}
                  completed={completed}
                  completedTask={completedTask}
                  template={template}
                  currentCompletedTasks={completedTasks}
                  isPending={toggleTask.isPending}
                  onToggle={() => handleToggleTask(task.name)}
                />
              );
            })}
          </div>

          {/* Summary */}
          {isComplete && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-success">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">All tasks completed!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskItemRowProps {
  taskName: string;
  taskDescription?: string;
  estimatedMinutes?: number;
  required: boolean;
  completed: boolean;
  completedTask?: CompletedTaskItem;
  template: TaskTemplate;
  currentCompletedTasks: CompletedTaskItem[];
  isPending: boolean;
  onToggle: () => void;
}

function TaskItemRow({
  taskName,
  taskDescription,
  estimatedMinutes,
  required,
  completed,
  completedTask,
  template,
  currentCompletedTasks,
  isPending,
  onToggle,
}: TaskItemRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadTaskPhoto();
  const deletePhoto = useDeleteTaskPhoto();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const photoUrls = completedTask?.photoUrls || [];

  async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Draw timestamp watermark
        const now = new Date();
        const ts = now.toLocaleString('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        const fontSize = Math.max(14, Math.round(width / 40));
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        const pad = 8;
        const textWidth = ctx.measureText(ts).width;
        ctx.fillRect(pad - 4, height - fontSize - pad - 4, textWidth + 8, fontSize + 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ts, pad, height - pad);

        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.82);
      };
      img.src = url;
    });
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    setUploading(true);
    try {
      const blobs = await Promise.all(files.map(compressImage));
      await uploadPhoto.mutateAsync({
        template,
        currentCompletedTasks,
        taskName,
        blobs,
      });
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePhoto(url: string, e: React.MouseEvent) {
    e.stopPropagation();
    deletePhoto.mutate({
      template,
      currentCompletedTasks,
      taskName,
      photoUrl: url,
    });
  }

  return (
    <>
      <div className={`rounded-lg transition-colors ${
        completed ? 'bg-success/10' : 'bg-background'
      }`}>
        {/* Main task row */}
        <div
          onClick={onToggle}
          className={`flex items-start gap-3 p-3 cursor-pointer rounded-lg ${
            completed ? 'hover:bg-success/20' : 'hover:bg-muted/50'
          }`}
        >
          {/* Checkbox */}
          <div className="flex-shrink-0 mt-0.5">
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : completed ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${completed ? 'text-success line-through' : 'text-foreground'}`}>
              {taskName}
            </p>
            {taskDescription && (
              <p className="text-xs text-muted-foreground mt-0.5">{taskDescription}</p>
            )}
            <div className="flex items-center gap-3 mt-1">
              {estimatedMinutes && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  ~{estimatedMinutes} min
                </span>
              )}
              {required && !completed && (
                <span className="flex items-center gap-1 text-xs text-warning">
                  <AlertCircle className="h-3 w-3" />
                  Required
                </span>
              )}
              {completed && completedTask && (
                <span className="text-xs text-success">
                  Done at {new Date(completedTask.completedAt).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Camera button — stop propagation so it doesn't toggle task */}
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            disabled={uploading || uploadPhoto.isPending}
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              uploading || uploadPhoto.isPending
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title="Attach photo(s)"
          >
            {uploading || uploadPhoto.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
        </div>

        {/* Photo thumbnail strip */}
        {photoUrls.length > 0 && (
          <div className="px-3 pb-3 flex flex-wrap gap-2">
            {photoUrls.map((url, i) => (
              <div key={i} className="relative group">
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="h-16 w-16 object-cover rounded-lg border border-border cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setLightboxUrl(url); }}
                />
                {/* Zoom hint */}
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setLightboxUrl(url); }}
                >
                  <ZoomIn className="h-4 w-4 text-white" />
                </div>
                {/* Remove button */}
                <button
                  onClick={(e) => handleRemovePhoto(url, e)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove photo"
                >
                  <X className="h-2.5 w-2.5 text-destructive-foreground" />
                </button>
              </div>
            ))}
            {/* Add more photos button */}
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              disabled={uploading || uploadPhoto.isPending}
              className="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              title="Add more photos"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// Compact checklist summary for dashboard
export interface TaskChecklistSummaryProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function TaskChecklistSummary({ noContainer = false }: TaskChecklistSummaryProps) {
  const { data: openingTemplates } = useMyTaskTemplates('opening');
  const { data: closingTemplates } = useMyTaskTemplates('closing');

  const hour = new Date().getHours();
  const isOpening = hour < 16; // Before 4pm, show opening tasks
  const relevantTemplates = isOpening ? openingTemplates : closingTemplates;

  const content = (
    <>
      {relevantTemplates?.length ? (
        <div className="space-y-2">
          {relevantTemplates.slice(0, 3).map((template) => (
            <TemplateProgress key={template.id} template={template} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No checklists for your role</p>
      )}
    </>
  );

  if (noContainer) {
    return <div className="space-y-3">{content}</div>;
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          {isOpening ? 'Opening' : 'Closing'} Checklists
        </h3>
      </div>
      {content}
    </div>
  );
}

function TemplateProgress({ template }: { template: TaskTemplate }) {
  const { data: completion } = useTaskCompletion(template.id);
  
  const completedCount = completion?.completedTasks.length || 0;
  const totalTasks = template.tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const isComplete = completedCount === totalTasks;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isComplete ? 'text-success' : 'text-foreground/80'}`}>
          {template.name}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
          <div 
            className={`h-full ${isComplete ? 'bg-success' : 'bg-primary'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-xs font-medium w-8 ${isComplete ? 'text-success' : 'text-muted-foreground'}`}>
          {progress}%
        </span>
      </div>
    </div>
  );
}
