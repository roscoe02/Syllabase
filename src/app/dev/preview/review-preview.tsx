"use client";

import { useState } from "react";
import { SyllabusReview } from "@/components/syllabus-review";
import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import type { Freshness } from "@/lib/syllabus/staleness";

export function ReviewPreview({ initial, freshness }: { initial: ParsedSyllabus; freshness: Freshness }) {
  const [value, setValue] = useState(initial);
  return <SyllabusReview value={value} onChange={setValue} freshness={freshness} />;
}
