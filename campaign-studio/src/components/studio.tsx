"use client";

import { useCallback, useRef, useState } from "react";

import type { Aspect } from "@/lib/options";
import type { BriefRequest, ConceptPackage } from "@/lib/schemas";
import type {
  ApiErrorBody,
  GenerateResponse,
  ImageResponse,
} from "@/lib/types";
import { BriefForm } from "@/components/brief-form";
import { ConceptBoard } from "@/components/concept-board";
import { EmptyDesk, ErrorSlip, LoadingBoard } from "@/components/states";

/* ------------------------------------------------------------------ */
/* Client-side state machine.                                           */
/*                                                                      */
/* This component only ever talks to /api/generate and /api/image —     */
/* never to OpenAI directly. See README "Client/server boundary".       */
/* ------------------------------------------------------------------ */

export type ImageSlot = {
  status: "loading" | "done" | "error";
  src?: string;
  revisedPrompt?: string | null;
  error?: string;
};

type Phase =
  | { name: "empty" }
  | { name: "generating"; brief: BriefRequest }
  | { name: "error"; message: string; brief: BriefRequest }
  | {
      name: "ready";
      jobId: string;
      brief: BriefRequest;
      pkg: ConceptPackage;
    };

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.error?.message ?? `Request failed (${res.status}).`;
  } catch {
    return `Request failed (${res.status}).`;
  }
}

export function Studio() {
  const [phase, setPhase] = useState<Phase>({ name: "empty" });
  const [images, setImages] = useState<ImageSlot[]>([]);
  // Guards stale async updates when the user re-submits mid-flight.
  const runIdRef = useRef(0);

  const fetchImage = useCallback(
    async (runId: number, index: number, prompt: string, aspect: Aspect) => {
      const update = (slot: ImageSlot) => {
        if (runIdRef.current !== runId) return;
        setImages((prev) => {
          const next = [...prev];
          next[index] = slot;
          return next;
        });
      };
      update({ status: "loading" });
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, aspect }),
        });
        if (!res.ok) {
          update({ status: "error", error: await readError(res) });
          return;
        }
        const data = (await res.json()) as ImageResponse;
        update({
          status: "done",
          src: `data:${data.mimeType};base64,${data.b64}`,
          revisedPrompt: data.revisedPrompt,
        });
      } catch {
        update({ status: "error", error: "Network error while rendering." });
      }
    },
    []
  );

  const submit = useCallback(
    async (brief: BriefRequest) => {
      const runId = ++runIdRef.current;
      setPhase({ name: "generating", brief });
      setImages([]);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brief),
        });
        if (runIdRef.current !== runId) return;
        if (!res.ok) {
          setPhase({ name: "error", message: await readError(res), brief });
          return;
        }
        const data = (await res.json()) as GenerateResponse;
        if (runIdRef.current !== runId) return;
        setPhase({ name: "ready", jobId: data.jobId, brief, pkg: data.package });
        // Fan out one request per prompt so images land independently.
        setImages(data.package.imagePrompts.map(() => ({ status: "loading" })));
        data.package.imagePrompts.forEach((p, i) => {
          void fetchImage(runId, i, p.prompt, p.aspect);
        });
      } catch {
        if (runIdRef.current !== runId) return;
        setPhase({
          name: "error",
          message: "Could not reach the studio. Check your connection and retry.",
          brief,
        });
      }
    },
    [fetchImage]
  );

  const retryImage = useCallback(
    (index: number) => {
      if (phase.name !== "ready") return;
      const p = phase.pkg.imagePrompts[index];
      if (!p) return;
      void fetchImage(runIdRef.current, index, p.prompt, p.aspect);
    },
    [phase, fetchImage]
  );

  return (
    <main className="grid gap-10 pt-8 lg:grid-cols-[minmax(320px,380px)_1fr] lg:gap-12">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <BriefForm busy={phase.name === "generating"} onSubmit={submit} />
      </div>

      <section aria-live="polite" className="min-w-0">
        {phase.name === "empty" && <EmptyDesk />}
        {phase.name === "generating" && <LoadingBoard />}
        {phase.name === "error" && (
          <ErrorSlip
            message={phase.message}
            onRetry={() => void submit(phase.brief)}
          />
        )}
        {phase.name === "ready" && (
          <ConceptBoard
            jobId={phase.jobId}
            brief={phase.brief}
            pkg={phase.pkg}
            images={images}
            onRetryImage={retryImage}
          />
        )}
      </section>
    </main>
  );
}
