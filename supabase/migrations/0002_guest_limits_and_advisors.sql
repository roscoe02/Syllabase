-- Site-wide AI cap, plus fixes from the Supabase database advisor.

-- Total AI usage today across all users, for the site-wide daily cap (src/lib/ai/quota.ts). Server only.
create function public.site_usage_today() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(weighted_tokens), 0)::bigint from public.usage_daily where day = current_date;
$$;
revoke execute on function public.site_usage_today from public, anon, authenticated;

-- A trigger function only; it should never be callable through the API.
revoke execute on function public.handle_new_user from public, anon, authenticated;

-- Evaluate auth.uid() once per query instead of once per row (advisor lint 0003_auth_rls_initplan).
alter policy "read own profile" on public.profiles using (id = (select auth.uid()));
alter policy "update own profile" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "own rows" on public.courses
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "own rows" on public.documents
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.owns_course(course_id));
alter policy "own rows" on public.syllabi
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and public.owns_document(document_id));
alter policy "own rows" on public.events
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.owns_course(course_id));
alter policy "own rows" on public.chat_threads
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.owns_course(course_id));
alter policy "own rows" on public.chat_messages
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.owns_thread(thread_id));
alter policy "own rows" on public.grade_entries
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and public.owns_event(event_id));
alter policy "own rows" on public.grade_weights
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.owns_course(course_id));
alter policy "own rows" on public.calendar_feeds
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "read own usage" on public.usage_daily using (user_id = (select auth.uid()));
alter policy "own files" on storage.objects
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
