"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** Keeps the selected tab in the URL (?tab=…) so it survives refresh and can be linked to. */
export function useTab<T extends string>(fallback: T, allowed: readonly T[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab") as T | null;
  const tab = raw && allowed.includes(raw) ? raw : fallback;
  const setTab = useCallback(
    (t: T) => {
      const p = new URLSearchParams(params.toString());
      p.set("tab", t);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [params, router, pathname],
  );
  return [tab, setTab] as const;
}

/** Opens a form when the page is reached with ?new=1 (used by dashboard shortcuts). */
export function useNewParam() {
  const params = useSearchParams();
  return params.get("new") === "1";
}
