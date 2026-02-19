-- Maintenance Tasks
create table if not exists maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text check (category in ('electrical','plumbing','structural','equipment','aesthetic','safety','other')) default 'other',
  priority text check (priority in ('high','medium','low')) default 'medium',
  status text check (status in ('open','in_progress','done')) default 'open',
  location text,
  estimated_cost numeric,
  reported_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table maintenance_tasks enable row level security;

create policy "maintenance_tasks_select" on maintenance_tasks
  for select using (auth.role() = 'authenticated');

create policy "maintenance_tasks_insert" on maintenance_tasks
  for insert with check (auth.role() = 'authenticated');

create policy "maintenance_tasks_update" on maintenance_tasks
  for update using (auth.role() = 'authenticated');

create policy "maintenance_tasks_delete" on maintenance_tasks
  for delete using (auth.role() = 'authenticated');
