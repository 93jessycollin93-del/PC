"use client";

import { useState } from "react";

import { CHANNELS, TONES, type Channel, type Tone } from "@/lib/options";
import { briefRequestSchema, type BriefRequest } from "@/lib/schemas";

type Props = {
  busy: boolean;
  onSubmit: (brief: BriefRequest) => void;
};

type FieldErrors = Partial<Record<"brief" | "audience" | "product" | "channels", string>>;

const FIELD_NO = {
  brief: "01",
  audience: "02",
  product: "03",
  tone: "04",
  channels: "05",
} as const;

function FieldLabel({
  no,
  label,
  htmlFor,
}: {
  no: string;
  label: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-baseline justify-between font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-soft"
    >
      <span>{label}</span>
      <span aria-hidden>{no}</span>
    </label>
  );
}

export function BriefForm({ busy, onSubmit }: Props) {
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [product, setProduct] = useState("");
  const [tone, setTone] = useState<Tone>("Bold");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});

  const toggleChannel = (c: Channel) => {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
    setErrors((prev) => ({ ...prev, channels: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = briefRequestSchema.safeParse({
      brief,
      audience,
      product,
      tone,
      channels,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  const inputClass = (invalid: boolean) =>
    `w-full rounded-sm border bg-card px-3 py-2.5 text-[15px] leading-snug shadow-card outline-none transition-colors placeholder:text-ink-soft/50 focus:border-cobalt focus:ring-2 focus:ring-cobalt/25 ${
      invalid ? "border-redline" : "border-line"
    }`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-md border border-line bg-card p-5 shadow-card sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between border-b border-dashed border-line pb-4">
        <h2 className="display-wide text-lg font-bold uppercase">Job ticket</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          New brief
        </span>
      </div>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <FieldLabel no={FIELD_NO.brief} label="Campaign brief" htmlFor="brief" />
          <textarea
            id="brief"
            rows={4}
            value={brief}
            disabled={busy}
            onChange={(e) => {
              setBrief(e.target.value);
              setErrors((p) => ({ ...p, brief: undefined }));
            }}
            placeholder="What are we launching, and what should it achieve? e.g. Spring launch for our new cold-brew concentrate; goal is first-time trial among subscribers."
            aria-invalid={Boolean(errors.brief)}
            className={inputClass(Boolean(errors.brief))}
          />
          {errors.brief && (
            <p className="font-mono text-xs text-redline">{errors.brief}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <FieldLabel no={FIELD_NO.audience} label="Target audience" htmlFor="audience" />
          <input
            id="audience"
            type="text"
            value={audience}
            disabled={busy}
            onChange={(e) => {
              setAudience(e.target.value);
              setErrors((p) => ({ ...p, audience: undefined }));
            }}
            placeholder="e.g. Busy professionals 28–45 who already buy specialty coffee"
            aria-invalid={Boolean(errors.audience)}
            className={inputClass(Boolean(errors.audience))}
          />
          {errors.audience && (
            <p className="font-mono text-xs text-redline">{errors.audience}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <FieldLabel no={FIELD_NO.product} label="Product details" htmlFor="product" />
          <textarea
            id="product"
            rows={2}
            value={product}
            disabled={busy}
            onChange={(e) => {
              setProduct(e.target.value);
              setErrors((p) => ({ ...p, product: undefined }));
            }}
            placeholder="e.g. 500ml cold-brew concentrate, 20 servings, compostable bottle, $18"
            aria-invalid={Boolean(errors.product)}
            className={inputClass(Boolean(errors.product))}
          />
          {errors.product && (
            <p className="font-mono text-xs text-redline">{errors.product}</p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="w-full">
            <FieldLabel no={FIELD_NO.tone} label="Tone" />
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={busy}
                onClick={() => setTone(t)}
                aria-pressed={tone === t}
                className={`rounded-sm border px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wide transition-colors ${
                  tone === t
                    ? "border-ink bg-ink text-card"
                    : "border-line bg-card text-ink-soft hover:border-ink-soft hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="w-full">
            <FieldLabel no={FIELD_NO.channels} label="Channels" />
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => {
              const on = channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleChannel(c)}
                  aria-pressed={on}
                  className={`rounded-sm border px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wide transition-colors ${
                    on
                      ? "border-cobalt bg-cobalt text-card"
                      : "border-line bg-card text-ink-soft hover:border-ink-soft hover:text-ink"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {c}
                </button>
              );
            })}
          </div>
          {errors.channels && (
            <p className="font-mono text-xs text-redline">{errors.channels}</p>
          )}
        </fieldset>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-sm bg-cobalt px-4 py-3 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-card shadow-card transition-colors hover:bg-cobalt-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "In production…" : "Send to studio"}
      </button>
      <p className="mt-3 text-center font-mono text-[11px] text-ink-soft">
        Generates concept, copy, checklist &amp; artwork · ~30s
      </p>
    </form>
  );
}
