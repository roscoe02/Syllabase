-- Canvas (and other LMS) calendar import: course matching, de-duplication against syllabus items.

-- Course number + section from LMS feeds, e.g. "4337.007", used to match feed items to courses.
alter table public.courses add column canvas_key text;

-- Feed items belong to their feed: disconnecting a feed removes them.
alter table public.events add column feed_id uuid references public.calendar_feeds (id) on delete cascade;
create index on public.events (feed_id);

-- A syllabus item that a feed item covers (same assignment or exam) is hidden behind it, so nothing shows twice.
-- Cleared automatically if the feed item goes away.
alter table public.events add column replaced_by uuid references public.events (id) on delete set null;
create index on public.events (replaced_by);

-- Courses the student removed: their feed items aren't imported again.
alter table public.calendar_feeds add column hidden_course_keys text[] not null default '{}';
grant select (url_hash, hidden_course_keys) on public.calendar_feeds to authenticated;
grant update (hidden_course_keys) on public.calendar_feeds to authenticated;

create function public.owns_feed(f uuid) returns boolean
language sql stable set search_path = '' as $$
  select f is null or exists (select 1 from public.calendar_feeds where id = f and user_id = (select auth.uid()));
$$;

alter policy "own rows" on public.events
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and public.owns_feed(feed_id));

-- Re-links a feed's items to the syllabus items they cover, in one step: clears this feed's old links, then sets
-- the new ones. p_links: [{source_uid, syllabus_event_id}]. Server only (feed sync).
create function public.link_feed_duplicates(p_user uuid, p_feed uuid, p_links jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.events s set replaced_by = null
  where s.user_id = p_user and s.source = 'syllabus'
    and s.replaced_by in (select f.id from public.events f where f.user_id = p_user and f.feed_id = p_feed);
  update public.events s set replaced_by = f.id
  from jsonb_to_recordset(p_links) as l(source_uid text, syllabus_event_id uuid)
  join public.events f on f.user_id = p_user and f.feed_id = p_feed and f.source_uid = l.source_uid
  where s.id = l.syllabus_event_id and s.user_id = p_user and s.source = 'syllabus';
$$;
revoke execute on function public.link_feed_duplicates from public, anon, authenticated;
