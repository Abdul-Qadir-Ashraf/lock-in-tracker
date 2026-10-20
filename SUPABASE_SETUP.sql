-- Lock-In Tracker: shared access for exactly the two authenticated profile emails.
-- Run this in Supabase SQL Editor after creating both Auth users.
-- Existing local browser data is not touched by this SQL.

-- The original table already exists from the earlier setup. Ensure RLS is on.
alter table public.tracker_data enable row level security;

drop policy if exists "lockin_two_profiles_select" on public.tracker_data;
drop policy if exists "lockin_two_profiles_insert" on public.tracker_data;
drop policy if exists "lockin_two_profiles_update" on public.tracker_data;

-- Permit the two tracker accounts to read all profile partitions, while keeping
-- every other authenticated account blocked. The app writes only under its own auth user_id.
create policy "lockin_two_profiles_select"
on public.tracker_data for select to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('vishwajeet@roll.com', 'qadirashrafabdul@gmail.com'));

create policy "lockin_two_profiles_insert"
on public.tracker_data for insert to authenticated
with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('vishwajeet@roll.com', 'qadirashrafabdul@gmail.com') and auth.uid() = user_id);

create policy "lockin_two_profiles_update"
on public.tracker_data for update to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) in ('vishwajeet@roll.com', 'qadirashrafabdul@gmail.com'))
with check (lower(coalesce(auth.jwt() ->> 'email', '')) in ('vishwajeet@roll.com', 'qadirashrafabdul@gmail.com') and auth.uid() = user_id);

-- No DELETE policy is intentionally created: browser code cannot delete cloud backups.
