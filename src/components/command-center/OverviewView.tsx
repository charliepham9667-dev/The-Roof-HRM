import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, CheckCircle, FolderKanban, Plus } from "lucide-react"

import { Button, ProgressRing, WidgetCard } from "@/components/ui"
import { cn } from "@/lib/utils"
import { ProjectModal } from "./ProjectModal"

interface Task {
  id: string
  status: string
  priority: string
  projectId?: string | null
}

interface Project {
  id: string
  title: string
  status: string
  progress: number
  color: string | null
}

interface OverviewViewProps {
  tasks: Task[]
  projects: Project[]
}

export function OverviewView({ tasks, projects }: OverviewViewProps) {
  const navigate = useNavigate()
  const [projectModalOpen, setProjectModalOpen] = useState(false)

  const taskStats = useMemo(() => {
    const todo = tasks.filter((t) => t.status === "todo").length
    const inProgress = tasks.filter((t) => t.status === "in_progress").length
    const blocked = tasks.filter((t) => t.status === "blocked").length
    const done = tasks.filter((t) => t.status === "done").length
    const total = tasks.length

    return { todo, inProgress, blocked, done, total }
  }, [tasks])

  const activeProjects = projects.filter((p) => p.status === "active")

  const completionRate =
    taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <WidgetCard title="Task Overview" icon={CheckCircle}>
        <div className="flex items-center gap-6">
          <ProgressRing value={completionRate} size="lg" color="success">
            <div className="text-center">
              <span className="text-2xl font-bold">{completionRate}%</span>
              <p className="text-xs text-muted-foreground">Done</p>
            </div>
          </ProgressRing>

          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">To Do</span>
              <span className="text-sm font-medium">{taskStats.todo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">In Progress</span>
              <span className="text-sm font-medium">{taskStats.inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Blocked</span>
              <span className="text-sm font-medium text-error">{taskStats.blocked}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Done</span>
              <span className="text-sm font-medium text-success">{taskStats.done}</span>
            </div>
          </div>
        </div>
      </WidgetCard>

      <WidgetCard
        title="Active Projects"
        icon={FolderKanban}
        headerAction={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setProjectModalOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/owner/task-delegation")}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        }
      >
        {activeProjects.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <FolderKanban className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>No active projects</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeProjects.slice(0, 4).map((project) => (
              <div
                key={project.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full",
                      project.color === "red" && "bg-red-500",
                      project.color === "orange" && "bg-orange-500",
                      project.color === "yellow" && "bg-yellow-500",
                      project.color === "green" && "bg-green-500",
                      project.color === "blue" && "bg-blue-500",
                      project.color === "purple" && "bg-purple-500",
                      project.color === "pink" && "bg-pink-500",
                      (!project.color || project.color === "default") && "bg-primary",
                    )}
                  />
                  <span className="text-sm font-medium">{project.title}</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground">
                    {project.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>

      <ProjectModal open={projectModalOpen} onOpenChange={setProjectModalOpen} />
    </div>
  )
}

