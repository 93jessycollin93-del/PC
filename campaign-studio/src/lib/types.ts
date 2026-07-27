import type { ConceptPackage } from "@/lib/schemas";

/** Success payload of POST /api/generate */
export type GenerateResponse = {
  jobId: string;
  package: ConceptPackage;
};

/** Success payload of POST /api/image */
export type ImageResponse = {
  b64: string;
  mimeType: string;
  revisedPrompt: string | null;
};

/** Error payload shared by both API routes */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};
