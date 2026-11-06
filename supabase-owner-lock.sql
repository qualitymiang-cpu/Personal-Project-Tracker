-- =====================================================================
--  Personal Project Tracker — owner-only lock
--
--  ทำอะไร: ทำให้ "เจ้าของคนเดียว" เท่านั้นที่อ่าน/เขียนตาราง projects ได้
--          แม้จะมีบัญชีอื่นโผล่ขึ้นมาในระบบ (เช่น เผลอเปิดให้สมัครอีก)
--          บัญชีอื่นจะเห็นตารางว่างและเขียนอะไรไม่ได้เลย
--
--  วิธีใช้:
--   1) Supabase -> Authentication -> Users -> คัดลอก "User UID" ของบัญชีท่าน
--   2) แทนที่ข้อความ OWNER_UUID_HERE ด้านล่าง (1 จุด) ด้วย UID นั้น
--      เก็บเครื่องหมาย ' ' ไว้ เช่น 'a1b2c3d4-0000-0000-0000-000000000000'
--   3) SQL Editor -> New query -> วางทั้งไฟล์ -> Run
--
--  ถ้าลืมแทนที่ข้อความ: Postgres จะฟ้อง "invalid input syntax for type uuid"
--  และยกเลิกทั้งสคริปต์ ไม่มีอะไรเปลี่ยน ท่านจะไม่ถูกล็อกออกจากข้อมูลตัวเอง
--
--  รันซ้ำได้ปลอดภัย (ถ้าจะเปลี่ยนเจ้าของ แก้ UID แล้วรันใหม่)
--  ต้องรัน supabase-setup.sql มาก่อนแล้ว
-- =====================================================================

create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() = 'OWNER_UUID_HERE'::uuid;
$$;

drop policy if exists "read own projects"   on public.projects;
drop policy if exists "insert own projects" on public.projects;
drop policy if exists "update own projects" on public.projects;
drop policy if exists "delete own projects" on public.projects;

create policy "read own projects" on public.projects
  for select using (auth.uid() = user_id and public.is_owner());

create policy "insert own projects" on public.projects
  for insert with check (auth.uid() = user_id and public.is_owner());

create policy "update own projects" on public.projects
  for update using (auth.uid() = user_id and public.is_owner())
             with check (auth.uid() = user_id and public.is_owner());

create policy "delete own projects" on public.projects
  for delete using (auth.uid() = user_id and public.is_owner());

-- ตรวจผล (รันแยกหลังจากนี้ได้): ต้องได้ rls_enabled = true, policy_count = 4
-- select
--   (select rowsecurity from pg_tables
--      where schemaname = 'public' and tablename = 'projects') as rls_enabled,
--   (select count(*) from pg_policies where tablename = 'projects') as policy_count;
