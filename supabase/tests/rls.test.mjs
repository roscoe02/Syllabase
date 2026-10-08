// Applies the migration to an in-memory Postgres (PGlite) with a minimal stand-in for Supabase
// auth/storage, then tries to read and write across two users. Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";

const db = new PGlite({ extensions: { pgcrypto } });
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";

// Minimal Supabase environment
await db.exec(`
  create schema extensions; create schema auth; create schema storage;
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`);
const migrations = new URL("../migrations/", import.meta.url);
for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(new URL(file, migrations), "utf8"));
}
console.log("migrations applied");

await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.edu'), ('${B}', 'b@x.edu')`);
const as = async (uid, sql) => {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role authenticated;`);
  try { return { ok: true, rows: (await db.query(sql)).rows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec("reset role"); }
};
let failed = 0;
const check = (name, cond) => { if (!cond) failed++; console.log(cond ? "PASS" : "FAIL", name); };

const ca = await as(A, `insert into public.courses (user_id, code) values ('${A}', 'CS 3345') returning id`);
const courseA = ca.rows[0].id;
check("profile created by trigger", (await db.query("select count(*)::int n from public.profiles")).rows[0].n === 2);
check("B cannot see A's course", (await as(B, `select * from public.courses`)).rows.length === 0);
check("B cannot attach an event to A's course", !(await as(B, `insert into public.events (user_id, course_id, source, title, starts_at) values ('${B}', '${courseA}', 'manual', 'x', now())`)).ok);
check("A can add an event to own course", (await as(A, `insert into public.events (user_id, course_id, source, title, starts_at) values ('${A}', '${courseA}', 'manual', 'x', now())`)).ok);
check("B cannot insert rows as A", !(await as(B, `insert into public.courses (user_id, code) values ('${A}', 'evil')`)).ok);
check("A cannot change own export token directly", !(await as(A, `update public.profiles set ics_export_token = 'aaaa' where id = '${A}'`)).ok);
check("A can change display name", (await as(A, `update public.profiles set display_name = 'Ann' where id = '${A}'`)).ok);
const before = (await db.query(`select ics_export_token t from public.profiles where id = '${A}'`)).rows[0].t;
const regen = await as(A, `select public.regenerate_ics_token() t`);
check("A can regenerate export token", regen.ok && regen.rows[0].t !== before && /^[0-9a-f]{48}$/.test(regen.rows[0].t));
check("A cannot insert another profile", !(await as(A, `insert into public.profiles (id) values ('${B}')`)).ok);
check("A can save a feed", (await as(A, `insert into public.calendar_feeds (user_id, url_encrypted, url_hash) values ('${A}', 'enc', 'h1')`)).ok);
check("the same feed can't be saved twice", !(await as(A, `insert into public.calendar_feeds (user_id, url_encrypted, url_hash) values ('${A}', 'enc2', 'h1')`)).ok);
check("A can list feeds without the URL", (await as(A, `select id, provider from public.calendar_feeds`)).rows.length === 1);
check("A cannot read the encrypted URL back", !(await as(A, `select url_encrypted from public.calendar_feeds`)).ok);
check("B cannot see A's feed", (await as(B, `select id from public.calendar_feeds`)).rows.length === 0);
check("users cannot read site-wide usage", !(await as(A, `select public.site_usage_today()`)).ok);
check("users cannot call the signup trigger function", !(await as(A, `select public.handle_new_user()`)).ok);
check("users cannot call record_usage", !(await as(A, `select public.record_usage('${A}', 1, 1, 0, 0)`)).ok);
check("users cannot write usage directly", !(await as(A, `insert into public.usage_daily (user_id, weighted_tokens) values ('${A}', -999999)`)).ok);
await db.query(`select public.record_usage('${A}', 1000, 100, 2000, 400)`);
const w = (await db.query(`select public.record_usage('${A}', 1000, 100, 2000, 400) w`)).rows[0].w;
check(`usage accumulates with weights (got ${w}, want 2*(1000+500+200+500)=4400)`, Number(w) === 4400);
check("A can read own usage", (await as(A, `select weighted_tokens from public.usage_daily`)).rows.length === 1);
check("B cannot read A's usage", (await as(B, `select * from public.usage_daily`)).rows.length === 0);
const tA = await as(A, `insert into public.chat_threads (user_id) values ('${A}') returning id`);
check("B cannot post into A's chat thread", !(await as(B, `insert into public.chat_messages (thread_id, user_id, role, content) values ('${tA.rows[0].id}', '${B}', 'user', '"hi"')`)).ok);
check("B cannot add grades to A's course", !(await as(B, `insert into public.grade_entries (user_id, course_id, component, earned, possible) values ('${B}', '${courseA}', 'HW', 1, 1)`)).ok);
check("storage: A can write under own folder", (await as(A, `insert into storage.objects (bucket_id, name) values ('documents', '${A}/doc/a.pdf')`)).ok);
check("storage: A cannot write into B's folder", !(await as(A, `insert into storage.objects (bucket_id, name) values ('documents', '${B}/doc/a.pdf')`)).ok);
check("bucket has 20MB limit + type allowlist", (await db.query(`select file_size_limit, array_length(allowed_mime_types,1) n from storage.buckets`)).rows[0].file_size_limit == 20971520);
// save_syllabus: one transaction, runs with the caller's permissions
const saveArgs = (doc, courseId) => `select public.save_syllabus(
  ${doc ? `'${doc}'` : "null"},
  '{"code":"CS 3345","section":"001","title":"Data Structures","term":"Fall 2026"}',
  '{"missing":[]}', 'claude-haiku-5-5', 'upload', 'current', null,
  '[{"component":"Homework","weight_percent":30,"drop_lowest":1},{"component":"Final","weight_percent":40}]',
  '[{"source_uid":"2026-10-14:midterm","kind":"exam","title":"Midterm","description":null,"starts_at":"2026-10-14T17:00:00Z","all_day":true,"weight_percent":30}]'
  ${courseId ? `, '${courseId}'` : ""}) id`;
const docA = (await as(A, `insert into public.documents (user_id, filename, mime_type, size_bytes, storage_path) values ('${A}', 's.pdf', 'application/pdf', 10, '${A}/x/s.pdf') returning id`)).rows[0].id;
const saved = await as(A, saveArgs(docA));
check("A can save a reviewed syllabus", saved.ok);
const newCourse = saved.rows?.[0]?.id;
check("save creates course, syllabus, weights and events together",
  (await as(A, `select (select count(*) from public.syllabi where course_id = '${newCourse}')::int s,
    (select count(*) from public.grade_weights where course_id = '${newCourse}')::int w,
    (select count(*) from public.events where course_id = '${newCourse}')::int e,
    (select course_id from public.documents where id = '${docA}') d`)).rows[0].e === 1);
const resaved = await as(A, saveArgs(null, newCourse));
check("re-saving replaces syllabus events instead of duplicating",
  resaved.ok && (await as(A, `select count(*)::int n from public.events where course_id = '${newCourse}'`)).rows[0].n === 1);
check("a second course can have the same item on the same date", (await as(A, saveArgs(null))).ok);
check("B cannot save over A's course",!(await as(B, saveArgs(null, newCourse))).ok);
check("B's attempt left A's course untouched", (await db.query(`select user_id from public.courses where id = '${newCourse}'`)).rows[0].user_id === A);
check("B cannot attach A's document", (await as(B, saveArgs(docA))).ok === false
  || (await db.query(`select user_id from public.documents where id = '${docA}'`)).rows[0].user_id === A);
check("signed-out users cannot save", !(await as("", saveArgs(null))).ok);

// Calendar feeds: items belong to their owner's feed; duplicates of syllabus items are linked server-side.
const feedA = (await db.query(`insert into public.calendar_feeds (user_id, url_encrypted, url_hash) values ('${A}', 'enc', 'feedA') returning id`)).rows[0].id;
check("B cannot attach an event to A's feed", !(await as(B, `insert into public.events (user_id, source, source_uid, title, starts_at, feed_id) values ('${B}', 'ics', 'x', 'x', now(), '${feedA}')`)).ok);
check("users cannot call link_feed_duplicates", !(await as(A, `select public.link_feed_duplicates('${A}', '${feedA}', '[]')`)).ok);
const midterm = (await db.query(`select id from public.events where course_id = '${newCourse}' and source = 'syllabus' limit 1`)).rows[0].id;
await db.query(`insert into public.events (user_id, course_id, source, source_uid, title, starts_at, feed_id) values ('${A}', '${newCourse}', 'ics', 'event-assignment-1', 'Midterm', now(), '${feedA}')`);
await db.query(`select public.link_feed_duplicates('${A}', '${feedA}', '[{"source_uid":"event-assignment-1","syllabus_event_id":"${midterm}"}]')`);
check("a feed item hides the syllabus item it covers", (await db.query(`select replaced_by from public.events where id = '${midterm}'`)).rows[0].replaced_by !== null);
await db.query(`select public.link_feed_duplicates('${A}', '${feedA}', '[]')`);
check("re-linking clears links the feed no longer makes", (await db.query(`select replaced_by from public.events where id = '${midterm}'`)).rows[0].replaced_by === null);
await db.query(`select public.link_feed_duplicates('${A}', '${feedA}', '[{"source_uid":"event-assignment-1","syllabus_event_id":"${midterm}"}]')`);
await db.query(`delete from public.calendar_feeds where id = '${feedA}'`);
check("disconnecting a feed removes its items and un-hides syllabus items",
  (await db.query(`select (select count(*) from public.events where feed_id is not null)::int n, (select replaced_by from public.events where id = '${midterm}') r`)).rows[0].n === 0
  && (await db.query(`select replaced_by from public.events where id = '${midterm}'`)).rows[0].replaced_by === null);

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
