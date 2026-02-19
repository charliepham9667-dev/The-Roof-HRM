import { useEffect, useState } from "react"

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { useProjects, type Project } from "@/hooks/useProjects"

interface ProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
}

const colorOptions = [
  { value: "default", label: "Default", class: "bg-primary" },
  { value: "red", label: "Red", class: "bg-red-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
]

export function ProjectModal({ open, onOpenChange, project }: ProjectModalProps) {
  const { createProject, updateProject } = useProjects()
  const isEditing = !!project

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [color, setColor] = useState("default")
  const [dueDate, setDueDate] = useState("")

  useEffect(() => {
    if (project) {
      setTitle(project.title)
      setDescription(project.description || "")
      setPriority(project.priority)
      setColor(project.color || "default")
      setDueDate(project.due_date || "")
    } else {
      setTitle("")
      setDescription("")
      setPriority("medium")
      setColor("default")
      setDueDate("")
    }
  }, [project, open])

  const handleSubmit = async () => {
    if (!title.trim()) return

    try {
      if (isEditing && project) {
        await updateProject.mutateAsync({
          id: project.id,
          title: title.trim(),
          description: description.trim() || null,
          priority: priority as any,
          color,
          due_date: dueDate || null,
        })
      } else {
        await createProject.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
          priority: priority as any,
          color,
          due_date: dueDate || null,
        })
      }
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save project:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Project Name</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., New Cocktail Menu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${opt.class}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || createProject.isPending || updateProject.isPending}
          >
            {isEditing ? "Save Changes" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

