-- Procurement Wishlist Items
create table if not exists wishlist_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  quantity int not null default 1,
  estimated_cost numeric,
  priority text check (priority in ('high','medium','low')) default 'medium',
  status text check (status in ('request','approved','ordered','delivered')) default 'request',
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table wishlist_items enable row level security;

-- All authenticated users can view
create policy "wishlist_items_select" on wishlist_items
  for select using (auth.role() = 'authenticated');

-- Authenticated users can insert
create policy "wishlist_items_insert" on wishlist_items
  for insert with check (auth.role() = 'authenticated');

-- Authenticated users can update
create policy "wishlist_items_update" on wishlist_items
  for update using (auth.role() = 'authenticated');

-- Authenticated users can delete
create policy "wishlist_items_delete" on wishlist_items
  for delete using (auth.role() = 'authenticated');
