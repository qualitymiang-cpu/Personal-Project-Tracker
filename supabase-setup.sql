-- =====================================================================
--  Personal Project Tracker — Supabase setup
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> New query
--           คัดลอกไฟล์นี้ทั้งหมดไปวาง แล้วกด Run
--  ปลอดภัยที่จะรันซ้ำได้ (ใช้ if not exists / or replace ทั้งหมด)
-- =====================================================================

-- ---------- 1. ตารางเก็บโครงการ ----------
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  name           text not null,
  status         text not null default 'Not Started'
                   check (status in ('Not Started', 'In Progress', 'On Hold', 'Done')),
  progress       integer not null default 0
                   check (progress >= 0 and progress <= 100),
  due_date       date,
  goal           text not null default '',
  current_status text not null default '',
  completed_work text not null default '',
  next_actions   text not null default '',
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists projects_user_created_idx
  on public.projects (user_id, created_at);

-- ---------- 2. เปิด Row Level Security ----------
-- บรรทัดนี้สำคัญที่สุด: ทำให้แต่ละบัญชีเห็นเฉพาะข้อมูลของตัวเอง
-- แม้ว่า anon key จะเปิดเผยต่อสาธารณะก็ตาม
alter table public.projects enable row level security;

drop policy if exists "read own projects"   on public.projects;
drop policy if exists "insert own projects" on public.projects;
drop policy if exists "update own projects" on public.projects;
drop policy if exists "delete own projects" on public.projects;

create policy "read own projects" on public.projects
  for select using (auth.uid() = user_id);

create policy "insert own projects" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "update own projects" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own projects" on public.projects
  for delete using (auth.uid() = user_id);

-- ---------- 3. อัปเดตเวลาแก้ไขล่าสุดอัตโนมัติ ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
