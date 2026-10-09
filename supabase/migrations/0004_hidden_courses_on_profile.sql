-- Courses the student removed belong to the student, not to one feed: reconnecting Canvas with a new link
-- (or disconnecting and connecting again) must not bring them back.
alter table public.profiles add column hidden_course_keys text[] not null default '{}';
update public.profiles p
set hidden_course_keys = coalesce(
  (select array_agg(distinct k) from public.calendar_feeds f, unnest(f.hidden_course_keys) k where f.user_id = p.id),
  '{}');
alter table public.calendar_feeds drop column hidden_course_keys;
grant update (hidden_course_keys) on public.profiles to authenticated;
