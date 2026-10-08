import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/user";
import { upcomingTerms } from "@/lib/syllabus/terms";
import { AddCourseFlow } from "./add-course-flow";

export const metadata = { title: "Add a course · Syllabase" };

export default function NewCoursePage() {
  return (
    <main className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Add a course</h1>
        <p className="text-ink-muted">Upload the syllabus. We pull out the grading, exams and due dates for you to check.</p>
      </header>
      <Suspense fallback={<div className="skeleton h-48 w-full max-w-xl" aria-busy="true" aria-label="Loading" />}>
        <NewCourse />
      </Suspense>
    </main>
  );
}

async function NewCourse() {
  await getCurrentUser(); // signed-in only; also makes "today" a request-time value
  return <AddCourseFlow terms={upcomingTerms(new Date())} />;
}
