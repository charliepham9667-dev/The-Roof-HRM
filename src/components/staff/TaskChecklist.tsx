import { useState } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  ListChecks,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useMyTaskTemplates, useTaskCompletion, useToggleTaskItem } from '../../hooks/useTasks';
import type { TaskTemplate } from '../../types';

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
                <div
                  key={index}
                  onClick={() => handleToggleTask(task.name)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    completed 
                      ? 'bg-success/10 hover:bg-success/20' 
                      : 'bg-background hover:bg-muted/50'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-0.5">
                    {toggleTask.isPending ? (
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
                      {task.name}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {task.estimatedMinutes && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          ~{task.estimatedMinutes} min
                        </span>
                      )}
                      {task.required && !completed && (
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
                </div>
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
