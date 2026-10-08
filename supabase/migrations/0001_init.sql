-- Syllabase initial schema (Supabase / Postgres).
-- Every user-owned table has row-level security: a user can only see their own rows.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text,
  school           text default 'UT Dallas',
  timezone         text not null default 'America/Chicago',
  -- "How I learn" interview answers, injected into study prompts.
  learning_profile jsonb not null default '{}'::jsonb,
  -- Secret token for the subscribable ICS export (/api/calendar/<token>.ics).
  ics_export_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  digest_enabled   boolean not null default true,   -- Sunday "what's due this week" email
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  code             text,            -- "CS 3345"
  section          text,            -- "001"
  title            text,
  term             text,            -- "Fall 2026"
  instructor_name  text,
  instructor_email text,
  color            text,
  -- Optional links to public data (UTD Nebula professor/course ids, RMP teacher id).
  external_ids     jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index on public.courses (user_id);

-- ---------------------------------------------------------------------------
-- Uploaded documents (files live in the private "documents" storage bucket)
-- ---------------------------------------------------------------------------
create type public.document_kind as enum
  ('syllabus', 'notes', 'slides', 'assignment', 'rubric', 'past_exam', 'graded_work', 'other');
create type public.document_status as enum ('uploaded', 'processing', 'ready', 'failed');

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid references public.courses (id) on delete set null,
  kind             public.document_kind not null default 'other',
  filename         text not null,
  mime_type        text not null,
  size_bytes       bigint not null,
  storage_path     text not null,   -- "<user_id>/<document_id>/<filename>"
  text_content     text,            -- extracted text (docx/txt), for search + context
  status           public.document_status not null default 'uploaded',
  error            text,
  created_at       timestamptz not null default now()
);
create index on public.documents (user_id, course_id);

-- Structured syllabus extraction (see src/lib/ai/syllabus-schema.ts).
-- Upload is the primary source. CourseBook copies (via Nebula syllabus_uri) are often last semester's,
-- so they carry a freshness verdict (src/lib/syllabus/staleness.ts) and are replaced by any later upload.
create type public.syllabus_source as enum ('upload', 'coursebook');
create type public.syllabus_freshness as enum ('current', 'outdated', 'unknown');

create table public.syllabi (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  document_id      uuid references public.documents (id) on delete set null,
  source           public.syllabus_source not null default 'upload',
  source_url       text,            -- dox.utdallas.edu link for CourseBook copies
  freshness        public.syllabus_freshness not null default 'current',
  freshness_reason text,
  parsed           jsonb not null,
  model            text not null,
  created_at       timestamptz not null default now()
);
create index on public.syllabi (course_id);

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------
create type public.event_source as enum ('syllabus', 'ics', 'manual');
create type public.event_kind as enum
  ('class', 'exam', 'quiz', 'homework', 'project', 'paper', 'lab', 'reading', 'office_hours', 'other');

create table public.events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid references public.courses (id) on delete cascade,
  source           public.event_source not null,
  source_uid       text,            -- ICS UID or syllabus item key, for idempotent re-imports
  kind             public.event_kind not null default 'other',
  title            text not null,
  description      text,
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  all_day          boolean not null default false,
  weight_percent   numeric,
  url              text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, source, source_uid)
);
create index on public.events (user_id, starts_at);

-- Canvas / Blackboard / any ICS subscription. The URL contains a secret token: treat as a credential.
create table public.calendar_feeds (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider         text not null default 'canvas' check (provider in ('canvas', 'blackboard', 'd2l', 'moodle', 'google', 'outlook', 'other')),
  url_encrypted    text not null,   -- AES-256-GCM via src/lib/security/crypto.ts; never readable by the browser
  label            text,
  last_synced_at   timestamptz,
  last_error       text,
  created_at       timestamptz not null default now()
);

-- Scores the student enters for the grade calculator ("what do I need on the final?").
create table public.grade_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  event_id         uuid references public.events (id) on delete set null,
  component        text not null,   -- matches a grading component name, e.g. "Homework"
  title            text,
  earned           numeric not null,
  possible         numeric not null check (possible > 0),
  created_at       timestamptz not null default now()
);
create index on public.grade_entries (course_id);

-- Student edits to grading weights (overrides parsed syllabus; guesses flagged).
create table public.grade_weights (
  course_id        uuid not null references public.courses (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  component        text not null,
  weight_percent   numeric not null,
  is_guess         boolean not null default false,
  drop_lowest      integer not null default 0,
  primary key (course_id, component)
);

-- ---------------------------------------------------------------------------
-- Chat + usage
-- ---------------------------------------------------------------------------
create table public.chat_threads (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid references public.courses (id) on delete set null,
  preset_id        text,            -- src/lib/study/presets.ts id, null for free chat
  title            text,
  created_at       timestamptz not null default now()
);

create table public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  thread_id        uuid not null references public.chat_threads (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          jsonb not null,  -- Anthropic content blocks, stored verbatim
  input_tokens     integer,
  output_tokens    integer,
  created_at       timestamptz not null default now()
);
create index on public.chat_messages (thread_id, created_at);

-- Per-user daily token accounting for quotas (src/lib/ai/quota.ts). Day boundaries are UTC.
-- weighted_tokens = input + 1.25 x cache writes + 0.1 x cache reads + 5 x output (Haiku price ratios),
-- so the daily budget tracks actual cost.
create table public.usage_daily (
  user_id            uuid not null references auth.users (id) on delete cascade,
  day                date not null default current_date,
  input_tokens       bigint not null default 0,
  output_tokens      bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  weighted_tokens    bigint not null default 0,
  primary key (user_id, day)
);

-- Atomic increment, callable only by the server (service role).
create function public.record_usage(
  p_user uuid, p_input bigint, p_output bigint, p_cache_read bigint, p_cache_write bigint
) returns bigint
language sql security definer set search_path = '' as $$
  insert into public.usage_daily as u
    (user_id, day, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, weighted_tokens)
  values (
    p_user, current_date, p_input, p_output, p_cache_read, p_cache_write,
    p_input + ceil(p_cache_write * 1.25) + ceil(p_cache_read * 0.1) + p_output * 5
  )
  on conflict (user_id, day) do update set
    input_tokens       = u.input_tokens + excluded.input_tokens,
    output_tokens      = u.output_tokens + excluded.output_tokens,
    cache_read_tokens  = u.cache_read_tokens + excluded.cache_read_tokens,
    cache_write_tokens = u.cache_write_tokens + excluded.cache_write_tokens,
    weighted_tokens    = u.weighted_tokens + excluded.weighted_tokens
  returning weighted_tokens;
$$;
revoke execute on function public.record_usage from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.courses        enable row level security;
alter table public.documents      enable row level security;
alter table public.syllabi        enable row level security;
alter table public.events         enable row level security;
alter table public.calendar_feeds enable row level security;
alter table public.chat_threads   enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.usage_daily    enable row level security;
alter table public.grade_entries  enable row level security;
alter table public.grade_weights  enable row level security;

-- Profiles: users can read their row and change only harmless fields (no mass assignment of the
-- export token or id). Rows are created by the signup trigger and removed by account deletion.
create policy "read own profile"   on public.profiles for select using (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, school, timezone, learning_profile, digest_enabled) on public.profiles to authenticated;

-- New export link (old one stops working). Called from Settings.
create function public.regenerate_ics_token() returns text
language sql security definer set search_path = '' as $$
  update public.profiles set ics_export_token = encode(extensions.gen_random_bytes(24), 'hex')
  where id = auth.uid()
  returning ics_export_token;
$$;
revoke execute on function public.regenerate_ics_token from public, anon;
grant execute on function public.regenerate_ics_token to authenticated;

-- Ownership helpers: a row may only point at the caller's own course / thread / document / event,
-- so changing an id in a request can't attach data to someone else's records.
create function public.owns_course(c uuid) returns boolean
language sql stable set search_path = '' as $$
  select c is null or exists (select 1 from public.courses where id = c and user_id = auth.uid());
$$;
create function public.owns_document(d uuid) returns boolean
language sql stable set search_path = '' as $$
  select d is null or exists (select 1 from public.documents where id = d and user_id = auth.uid());
$$;
create function public.owns_event(e uuid) returns boolean
language sql stable set search_path = '' as $$
  select e is null or exists (select 1 from public.events where id = e and user_id = auth.uid());
$$;
create function public.owns_thread(t uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.chat_threads where id = t and user_id = auth.uid());
$$;

create policy "own rows" on public.courses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.documents for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_course(course_id));
create policy "own rows" on public.syllabi for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_course(course_id) and public.owns_document(document_id));
create policy "own rows" on public.events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_course(course_id));
create policy "own rows" on public.chat_threads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_course(course_id));
create policy "own rows" on public.chat_messages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_thread(thread_id));
create policy "own rows" on public.grade_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_course(course_id) and public.owns_event(event_id));
create policy "own rows" on public.grade_weights for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_course(course_id));

-- Calendar feeds: the browser may list and delete its feeds but can never read the (encrypted) URL back.
create policy "own rows" on public.calendar_feeds for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke select, update on public.calendar_feeds from anon, authenticated;
grant select (id, user_id, provider, label, last_synced_at, last_error, created_at) on public.calendar_feeds to authenticated;
grant update (label) on public.calendar_feeds to authenticated;

-- usage_daily is written only by the server (record_usage); users may read their own.
create policy "read own usage" on public.usage_daily for select using (user_id = auth.uid());

-- Create a profile row when a user signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Save a reviewed syllabus in one transaction (course + syllabus + grade weights + calendar events).
-- SECURITY INVOKER: runs as the calling user, so every insert/update is checked by the RLS policies above.
-- Pass p_course_id to replace an existing course's syllabus (e.g. a fresh upload over a CourseBook copy).
-- ---------------------------------------------------------------------------
create function public.save_syllabus(
  p_document_id uuid,
  p_course jsonb,     -- {code, section, title, term, instructor_name, instructor_email}
  p_parsed jsonb,     -- the reviewed ParsedSyllabus
  p_model text,
  p_source public.syllabus_source,
  p_freshness public.syllabus_freshness,
  p_freshness_reason text,
  p_weights jsonb,    -- [{component, weight_percent, drop_lowest}]
  p_events jsonb,     -- [{source_uid, kind, title, description, starts_at, all_day, weight_percent}]
  p_course_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_course uuid := p_course_id;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if v_course is null then
    insert into public.courses (user_id, code, section, title, term, instructor_name, instructor_email)
    values (v_user, p_course->>'code', p_course->>'section', p_course->>'title', p_course->>'term',
            p_course->>'instructor_name', p_course->>'instructor_email')
    returning id into v_course;
  else
    update public.courses set
      code = p_course->>'code', section = p_course->>'section', title = p_course->>'title',
      term = p_course->>'term', instructor_name = p_course->>'instructor_name',
      instructor_email = p_course->>'instructor_email'
    where id = v_course and user_id = v_user;
    if not found then
      raise exception 'course not found';
    end if;
    delete from public.events where course_id = v_course and source = 'syllabus';
    delete from public.grade_weights where course_id = v_course;
  end if;

  if p_document_id is not null then
    update public.documents set course_id = v_course, kind = 'syllabus', status = 'ready'
    where id = p_document_id and user_id = v_user;
  end if;

  insert into public.syllabi (user_id, course_id, document_id, source, freshness, freshness_reason, parsed, model)
  values (v_user, v_course, p_document_id, p_source, p_freshness, p_freshness_reason, p_parsed, p_model);

  insert into public.grade_weights (course_id, user_id, component, weight_percent, is_guess, drop_lowest)
  select v_course, v_user, w->>'component', (w->>'weight_percent')::numeric, false, coalesce((w->>'drop_lowest')::int, 0)
  from jsonb_array_elements(p_weights) w
  on conflict (course_id, component) do nothing;

  insert into public.events (user_id, course_id, source, source_uid, kind, title, description, starts_at, all_day, weight_percent)
  select v_user, v_course, 'syllabus', e->>'source_uid', (e->>'kind')::public.event_kind, e->>'title', e->>'description',
         (e->>'starts_at')::timestamptz, (e->>'all_day')::boolean, (e->>'weight_percent')::numeric
  from jsonb_array_elements(p_events) e;

  return v_course;
end;
$$;
revoke execute on function public.save_syllabus from public, anon;
grant execute on function public.save_syllabus to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files namespaced by user id
-- ---------------------------------------------------------------------------
-- Size and type limits are enforced by Storage itself, not just the browser. Files are only ever
-- downloaded and read as data (never executed or served as HTML).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 20971520, -- 20 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg', 'image/webp',
    'text/plain', 'text/markdown'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "own files" on storage.objects for all
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Later (RAG), once a course's materials outgrow the context window:
-- create extension if not exists vector;
-- create table public.document_chunks (
--   id bigserial primary key,
--   document_id uuid not null references public.documents (id) on delete cascade,
--   user_id uuid not null references auth.users (id) on delete cascade,
--   content text not null,
--   embedding vector(1024)
-- );
