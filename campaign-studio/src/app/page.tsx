import { Studio } from "@/components/studio";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink py-6">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-soft">
            Concept · Copy · Checklist · Artwork
          </p>
          <h1 className="display-wide mt-1 text-3xl font-bold uppercase sm:text-4xl">
            Campaign Concept Studio
          </h1>
        </div>
        <p className="max-w-xs font-mono text-xs leading-relaxed text-ink-soft">
          File a brief. The studio returns a proofed campaign package ready for
          review.
        </p>
      </header>
      <Studio />
    </div>
  );
}
