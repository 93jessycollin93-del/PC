# 🤖 INGESTION PROMPT FOR "CYBERNETIC OS"

Copy the exact text inside the box below and paste it into your **Cybernetic OS** AI Studio chat session (attach `/export/GeminiInkMonolithic.tsx` along with it):

***

### [COPY FROM HERE DOWNWARD]

**SYSTEM DIRECTIVE: MOUNT SUB-APPLICATION "GEMINI INK" INTO CYBERNETIC OS**

I have a complete, production-ready Virtual Operating System mini-app called **Gemini Ink** packaged into a single monolithic, zero-local-dependency React component: `GeminiInkMonolithic.tsx` (attached / provided).

Your task is to integrate this exact sub-OS into my parent CYBERNETIC OS project **without simplifying, stripping, or truncating any of its internal code**.

#### 1. Integration Rules:
1. **Verbatim Mount:** Do NOT rewrite, refactor, or condense `GeminiInkMonolithic.tsx`. Place the file into `/src/components/apps/GeminiInkMonolithic.tsx` (or your app catalog directory) exactly as provided.
2. **App Grid Registration:** Register "Gemini Ink" in Cybernetic OS's main app registry / desktop grid. Use `PenLine` or `Bot` or `Sparkles` from `lucide-react` as its launcher icon.
3. **Container Isolation:** When launched, render `<GeminiInkMiniApp />` inside Cybernetic OS's windowing container with full space allocated (`w-full h-full min-h-[550px]`).
4. **Dynamic Canvas Resilience:** The component self-loads `html2canvas` via CDN on mount and accesses the Gemini API via `process.env.GEMINI_API_KEY` automatically. Do not remove its auto-injector.

#### 2. Usage Example inside Cybernetic OS:
```tsx
import { GeminiInkMiniApp } from './GeminiInkMonolithic';

// Inside your OS Window/Modal wrapper:
<OSWindow id="gemini-ink" title="Gemini Ink Gestural OS">
    <GeminiInkMiniApp />
</OSWindow>
```

Please confirm once the sub-OS is mounted into the desktop grid!
