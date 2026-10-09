"use client";

import { useSyncExternalStore } from "react";

/**
 * Switches between light and dark. The choice is saved in this browser and applied before the page paints
 * (see the script in the root layout); until the student picks one, the theme follows the device.
 */

const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const isDark = () => {
  const picked = document.documentElement.dataset.theme;
  return picked ? picked === "dark" : media().matches;
};

function subscribe(onChange: () => void) {
  const m = media();
  m.addEventListener("change", onChange);
  window.addEventListener("themechange", onChange);
  return () => {
    m.removeEventListener("change", onChange);
    window.removeEventListener("themechange", onChange);
  };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // null on the server: the label appears once the browser knows the theme.
  const dark = useSyncExternalStore(subscribe, isDark, () => null);

  function toggle() {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode or blocked storage: the switch still applies to this page.
    }
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <button type="button" onClick={toggle} className={`${className} ${dark === null ? "invisible" : ""}`}>
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
