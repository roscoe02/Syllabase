"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

type Item = readonly [href: string, label: string];

/** Main nav links. The current section is marked once the URL is known (the shell itself is prerendered). */
export function NavLinks({ items }: { items: readonly Item[] }) {
  return (
    <Suspense fallback={items.map(([href, label]) => <NavLink key={href} href={href} label={label} current={false} />)}>
      <Marked items={items} />
    </Suspense>
  );
}

function Marked({ items }: { items: readonly Item[] }) {
  const path = usePathname();
  return items.map(([href, label]) => (
    <NavLink key={href} href={href} label={label} current={path === href || (href !== "/courses/new" && path.startsWith(`${href}/`))} />
  ));
}

function NavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={current ? "font-medium text-ink" : "text-ink-muted hover:text-ink"}>
      {label}
    </Link>
  );
}
