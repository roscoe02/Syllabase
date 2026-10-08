"use client";

/** A submit button that asks first, for actions that can't be undone. */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="submit" className={className} onClick={(e) => !window.confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}
