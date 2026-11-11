import { cn } from "@/lib/cn";

/** Simple mark: a building outline with a crane-hook accent. */
export function Logo({ className, light = true }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent-500 text-brand-950 shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 21h18" />
          <path d="M5 21V10l7-5 7 5v11" />
          <path d="M9 21v-6h6v6" />
          <path d="M12 2v3" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className={cn("block text-[15px] font-semibold tracking-tight", light ? "text-white" : "text-slate-900")}>Rohan Construction</span>
        <span className={cn("block text-[11px] font-medium tracking-wider uppercase", light ? "text-brand-200" : "text-slate-500")}>Project & Finance ERP</span>
      </span>
    </div>
  );
}
