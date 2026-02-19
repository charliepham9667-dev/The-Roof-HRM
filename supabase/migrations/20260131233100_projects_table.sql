-- ============================================================================
-- PROJECTS TABLE
-- Container for related tasks (e.g., "New Cocktail Menu", "Website Redesign")
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  color TEXT DEFAULT 'default' CHECK (color IN ('default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink')),
  due_date DATE,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view projects
CREATE POLICY "Users can view projects" ON projects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create projects" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Project owners and managers can update" ON projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR is_manager_or_owner())
  WITH CHECK (owner_id = auth.uid() OR is_manager_or_owner());

CREATE POLICY "Project owners and managers can delete" ON projects
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR is_owner());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ADD project_id TO delegation_tasks
-- Links tasks to projects (optional relationship)
-- ============================================================================
ALTER TABLE delegation_tasks
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_delegation_tasks_project ON delegation_tasks(project_id);

