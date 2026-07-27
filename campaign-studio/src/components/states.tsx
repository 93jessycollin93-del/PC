"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/* Empty, loading, and error states for the board column.               */
/* ------------------------------------------------------------------ */

/** Empty state: a pasteboard with registration marks, waiting for work. */
export function EmptyDesk() {
  return (
    <div className="relative flex min-h-[420px] flex-col items-center justify-center rounded-md border-2 border-dashed border-line p-8 text-center">
      {/* registration marks */}
      {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map(
        (pos) => (
          <span
            key={pos}
            aria-hidden
            className={`absolute ${pos} font-mono text-sm text-line`}
          >
            +
          </span>
        )
      )}
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        Board empty
      </p>
      <h2 className="display-wide mt-2 max-w-md text-2xl font-bold uppercase">
        Nothing pinned yet
      </h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
        Fill in the job ticket and send it to the studio. The proof comes back
        with a concept, three copy variants, a launch checklist, and campaign
        artwork.
      </p>
    </div>
  );
}

const STATUS_LINES = [
  "Reading the brief…",
  "Sizing up the audience…",
  "Sketching the concept…",
  "Writing variants A / B / C…",
  "Sequencing the launch plan…",
  "Preparing artwork plates…",
];

/** Loading state: IN PRODUCTION stamp + skeleton board + cycling status. */
export function LoadingBoard() {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setLine((n) => (n + 1) % STATUS_LINES.length),
      2400
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-8" role="status" aria-label="Generating campaign package">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="stamp text-cobalt">In production</span>
        <p className="font-mono text-xs text-ink-soft">
          {STATUS_LINES[line]}
          <span className="blink">▌</span>
        </p>
      </div>

      <div className="rounded-md border border-line bg-card p-6 shadow-card sm:p-8">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-4 h-9 w-3/4" />
        <div className="skeleton mt-3 h-5 w-1/2" />
        <div className="mt-5 space-y-2">
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3.5 w-5/6" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-sm border border-line bg-card p-5 shadow-card">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-3 h-5 w-4/5" />
            <div className="mt-3 space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}

/** Error state: a red correction slip, plain language, one retry action. */
export function ErrorSlip({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-md border-2 border-redline bg-card p-6 shadow-card sm:p-8">
      <span className="stamp text-redline">Returned with marks</span>
      <h2 className="display-wide mt-5 text-xl font-bold uppercase">
        The proof didn&apos;t come back
      </h2>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-sm bg-ink px-5 py-2.5 font-mono text-sm font-semibold uppercase tracking-[0.14em] text-card transition-colors hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Resubmit job
      </button>
    </div>
  );
}
