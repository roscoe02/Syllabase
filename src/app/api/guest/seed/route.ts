import { getProfile } from "@/lib/data/queries";
import { sampleSyllabi } from "@/lib/demo/sample-courses";
import { requireUser, serverError } from "@/lib/security/request";
import { saveSyllabus } from "@/lib/syllabus/save";
import { upcomingTerms } from "@/lib/syllabus/terms";
import { dateKey } from "@/lib/time";

/**
 * POST /api/guest/seed — gives a new guest account three sample courses, so the dashboard and
 * calendar show something right away. Guests only, and only while they have no courses.
 */
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, isGuest } = auth;
  if (!isGuest) return Response.json({ error: "Sample courses are for guest accounts." }, { status: 403 });

  const { count } = await supabase.from("courses").select("id", { count: "exact", head: true });
  if (count) return Response.json({ seeded: 0 });

  const { timezone: tz } = await getProfile(supabase);
  const today = dateKey(new Date(), tz);
  const term = upcomingTerms(new Date(`${today}T12:00:00Z`))[0];
  const samples = sampleSyllabi(today, term.name);
  for (const syllabus of samples) {
    const { error } = await saveSyllabus(supabase, { syllabus, term, tz, model: "sample" });
    if (error) return serverError("guest/seed save", error);
  }
  return Response.json({ seeded: samples.length });
}
