"use client";

import { CHANNEL_COLORS, type Aspect } from "@/lib/options";
import type { BriefRequest, ConceptPackage } from "@/lib/schemas";
import type { ImageSlot } from "@/components/studio";

/* ------------------------------------------------------------------ */
/* The pinned concept board — proof bar, concept, variants, checklist,  */
/* artwork. Pure presentation; all data arrives via props.              */
/* ------------------------------------------------------------------ */

type Props = {
  jobId: string;
  brief: BriefRequest;
  pkg: ConceptPackage;
  images: ImageSlot[];
  onRetryImage: (index: number) => void;
};

const ASPECT_CLASS: Record<Aspect, string> = {
  square: "aspect-square",
  landscape: "aspect-[3/2]",
  portrait: "aspect-[2/3]",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="display-wide mb-3 text-sm font-bold uppercase tracking-wide">
      {children}
    </h3>
  );
}

/** Signature element: the printer's proof bar. Chips = selected channels. */
function ProofBar({ jobId, brief }: { jobId: string; brief: BriefRequest }) {
  const jobNo = jobId.slice(-6).toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-sm border border-ink bg-card px-4 py-2.5 shadow-card">
      <div className="flex items-center gap-1" aria-label="Channel color chips">
        {brief.channels.map((c) => (
          <span
            key={c}
            title={c}
            className="h-4 w-4 border border-ink/20"
            style={{ backgroundColor: CHANNEL_COLORS[c] }}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
        Job №&nbsp;<span className="text-ink">{jobNo}</span>
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
        Tone&nbsp;<span className="text-ink">{brief.tone}</span>
      </span>
      <span className="ml-auto font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-approve">
        ● Proof ready
      </span>
    </div>
  );
}

function ArtworkCell({
  index,
  title,
  aspect,
  slot,
  onRetry,
}: {
  index: number;
  title: string;
  aspect: Aspect;
  slot: ImageSlot | undefined;
  onRetry: () => void;
}) {
  return (
    <figure className="min-w-0">
      <div
        className={`relative overflow-hidden rounded-sm border border-line bg-card shadow-card ${ASPECT_CLASS[aspect]}`}
      >
        {(!slot || slot.status === "loading") && (
          <div className="absolute inset-0">
            <div className="skeleton h-full w-full rounded-none" />
            <span className="absolute inset-x-0 bottom-3 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
              Rendering…
            </span>
          </div>
        )}
        {slot?.status === "done" && slot.src && (
          /* Data URLs — next/image adds nothing here. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.src}
            alt={`Generated campaign artwork: ${title}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {slot?.status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-redline/50 p-4 text-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-redline">
              Render failed
            </span>
            <p className="max-w-[24ch] text-xs leading-snug text-ink-soft">
              {slot.error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-sm border border-ink px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wide transition-colors hover:bg-ink hover:text-card"
            >
              Re-run plate
            </button>
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-medium text-ink">
          {String(index + 1).padStart(2, "0")} · {title}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
          {aspect}
        </span>
      </figcaption>
    </figure>
  );
}

export function ConceptBoard({ jobId, brief, pkg, images, onRetryImage }: Props) {
  return (
    <div className="space-y-8">
      <div className="rise" style={{ "--rise-i": 0 } as React.CSSProperties}>
        <ProofBar jobId={jobId} brief={brief} />
      </div>

      {/* Concept */}
      <section className="rise" style={{ "--rise-i": 1 } as React.CSSProperties}>
        <div className="rounded-md border border-line bg-card p-6 shadow-lift sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
            The concept
          </p>
          <h2 className="display-wide mt-2 text-3xl font-bold uppercase leading-tight sm:text-4xl">
            {pkg.concept.name}
          </h2>
          <p className="mt-2 text-lg font-medium">
            <span className="hl-marker">{pkg.concept.tagline}</span>
          </p>
          <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
            {pkg.concept.summary}
          </p>
          <div className="mt-5 border-l-4 border-cobalt pl-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
              Key message
            </p>
            <p className="mt-1 font-medium">{pkg.concept.keyMessage}</p>
          </div>
        </div>
      </section>

      {/* Copy variants */}
      <section className="rise" style={{ "--rise-i": 2 } as React.CSSProperties}>
        <SectionHeading>Copy variants</SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          {pkg.copyVariants.map((v) => (
            <article
              key={v.label}
              className="relative flex flex-col overflow-hidden rounded-sm border border-line bg-card p-5 shadow-card"
            >
              <span
                aria-hidden
                className="display-wide pointer-events-none absolute -right-2 -top-6 text-[92px] font-bold leading-none text-line-soft select-none"
              >
                {v.label}
              </span>
              <p className="relative font-mono text-[11px] uppercase tracking-[0.16em] text-cobalt">
                {v.angle}
              </p>
              <h4 className="relative mt-2 text-lg font-bold leading-snug">
                {v.headline}
              </h4>
              <p className="relative mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                {v.body}
              </p>
              <p className="relative mt-4 border-t border-dashed border-line pt-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                Best fit · {v.channelFit}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Launch checklist */}
      <section className="rise" style={{ "--rise-i": 3 } as React.CSSProperties}>
        <SectionHeading>Launch checklist</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          {pkg.launchChecklist.map((phase) => (
            <div
              key={phase.phase}
              className="rounded-sm border border-line bg-card p-5 shadow-card"
            >
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em]">
                <span className="hl-marker">{phase.phase}</span>
              </p>
              <ul className="space-y-3">
                {phase.items.map((item) => (
                  <li key={item.task} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 border-2 border-ink/60"
                    />
                    <div>
                      <p className="text-sm font-semibold leading-snug">
                        {item.task}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Artwork */}
      <section className="rise" style={{ "--rise-i": 4 } as React.CSSProperties}>
        <SectionHeading>Campaign artwork</SectionHeading>
        <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pkg.imagePrompts.map((p, i) => (
            <ArtworkCell
              key={`${p.title}-${i}`}
              index={i}
              title={p.title}
              aspect={p.aspect}
              slot={images[i]}
              onRetry={() => onRetryImage(i)}
            />
          ))}
        </div>
        <details className="mt-4 rounded-sm border border-dashed border-line bg-card/60 px-4 py-3">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
            Image prompts (for reuse)
          </summary>
          <ol className="mt-3 space-y-3">
            {pkg.imagePrompts.map((p, i) => (
              <li key={`prompt-${i}`} className="text-sm leading-relaxed">
                <span className="font-mono text-xs font-semibold uppercase">
                  {String(i + 1).padStart(2, "0")} {p.title} ·{" "}
                </span>
                <span className="text-ink-soft">{p.prompt}</span>
                {images[i]?.revisedPrompt && (
                  <p className="mt-1 font-mono text-[11px] text-ink-soft">
                    model revision → {images[i].revisedPrompt}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </details>
      </section>
    </div>
  );
}
