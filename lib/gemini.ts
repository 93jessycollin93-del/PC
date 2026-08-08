/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Tool, Type } from "@google/genai";
import { chat, type ChatMessage } from './ai/gateway';
import { getApiKey } from './ai/catalog';

/** A tool call returned by Gemini. */
export interface GeminiFunctionCall {
    name: string;
    args: Record<string, unknown>;
}

export const MODEL_NAME = "gemini-2.5-flash";

/**
 * The client the app roster already calls.
 *
 * 25 apps use `getAiClient().models.generateContent(...)`. It used to POST
 * straight to `/api/gemini/generate`, a route that only exists when the
 * Express host is running — so on a static deployment every one of those apps
 * failed exactly the way Jackie's chat did.
 *
 * Rather than edit 25 call sites, this now translates the Gemini-shaped
 * request into a `chat()` through the gateway. Every app therefore inherits
 * the whole provider chain, the keyring, and per-key rotation without
 * knowing any of it exists.
 *
 * ONE HONEST LIMIT: function calling is Gemini-specific here. When a request
 * carries tools we go straight to Gemini's native endpoint so the tool
 * contract is preserved; if Gemini has no key, we fall back to a text answer
 * and return no function calls rather than pretending otherwise.
 */
interface GeminiPart {
    text?: string;
    /** Images, for the ink-gesture flow in App.tsx. */
    inlineData?: { mimeType: string; data: string };
    [k: string]: unknown;
}
interface GeminiContent {
    role?: string;
    parts?: GeminiPart[];
    [k: string]: unknown;
}

interface GenerateRequest {
    model?: string;
    contents?: string | (GeminiContent | GeminiPart | string)[] | GeminiContent;
    config?: {
        tools?: unknown;
        systemInstruction?: unknown;
        temperature?: number;
        maxOutputTokens?: number;
        [k: string]: unknown;
    };
    [key: string]: unknown;
}

export interface GenerateResponse {
    text: string;
    functionCalls?: GeminiFunctionCall[];
    candidates: { content: { parts: GeminiPart[] } }[];
}

interface AiClient {
    models: { generateContent: (request: GenerateRequest) => Promise<GenerateResponse> };
}

/** Flatten Gemini's `contents` (string | object | array) into chat messages. */
function toMessages(req: GenerateRequest): ChatMessage[] {
    const messages: ChatMessage[] = [];

    const sys = req.config?.systemInstruction;
    if (typeof sys === 'string' && sys.trim()) {
        messages.push({ role: 'system', content: sys });
    } else if (sys && typeof sys === 'object') {
        const parts = (sys as { parts?: GeminiPart[] }).parts ?? [];
        const text = parts.map((p) => p.text ?? '').join('').trim();
        if (text) messages.push({ role: 'system', content: text });
    }

    const contents = req.contents;
    if (typeof contents === 'string') {
        messages.push({ role: 'user', content: contents });
        return messages;
    }
    const list = Array.isArray(contents) ? contents : contents ? [contents] : [];
    for (const c of list) {
        // An entry may be a bare string, a part ({text}/{inlineData}), or a
        // full content object with a role — the roster uses all three.
        if (typeof c === 'string') {
            if (c.trim()) messages.push({ role: 'user', content: c });
            continue;
        }
        const content = c as GeminiContent & GeminiPart;
        const parts = content.parts ?? [content];
        const text = parts.map((p) => (p as GeminiPart).text ?? '').join('').trim();
        if (!text) continue;
        messages.push({ role: content.role === 'model' ? 'assistant' : 'user', content: text });
    }
    if (messages.length === 0) messages.push({ role: 'user', content: '' });
    return messages;
}

let aiClient: AiClient | null = null;

export const getAiClient = (): AiClient => {
    if (!aiClient) {
        aiClient = {
            models: {
                generateContent: async (request: GenerateRequest): Promise<GenerateResponse> => {
                    const messages = toMessages(request);
                    const wantsTools = !!request.config?.tools;

                    // Tool calls only survive on Gemini's own wire, so when a
                    // caller asks for them, try that path first and keep the
                    // function calls intact.
                    if (wantsTools) {
                        const key = getApiKey('gemini');
                        if (key) {
                            try {
                                return await callGeminiWithTools(request, key);
                            } catch {
                                // fall through to a plain text answer
                            }
                        }
                    }

                    const result = await chat({
                        messages,
                        model: request.model ? `gemini:${request.model}` : undefined,
                        temperature: request.config?.temperature,
                        maxTokens: request.config?.maxOutputTokens,
                    });
                    return {
                        text: result.text,
                        functionCalls: [],
                        candidates: [{ content: { parts: [{ text: result.text }] } }],
                    };
                },
            },
        };
    }
    return aiClient;
};

/** Native Gemini call that preserves function calling. */
async function callGeminiWithTools(request: GenerateRequest, key: string): Promise<GenerateResponse> {
    const model = request.model || MODEL_NAME;
    const body: Record<string, unknown> = {
        contents: Array.isArray(request.contents)
            ? request.contents
            : [{ role: 'user', parts: [{ text: String(request.contents ?? '') }] }],
    };
    if (request.config?.tools) body.tools = request.config.tools;
    if (request.config?.systemInstruction) body.systemInstruction = request.config.systemInstruction;

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify(body),
        },
    );
    if (!res.ok) throw new Error(`Gemini returned ${res.status}`);
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: { text?: string }) => p.text ?? '').join('').trim();
    const functionCalls = parts
        .filter((p: { functionCall?: unknown }) => p.functionCall)
        .map((p: { functionCall: { name: string; args: Record<string, unknown> } }) => p.functionCall);
    return { text, functionCalls, candidates: [{ content: { parts: [{ text }] } }] };
}

export const HOME_TOOLS: Tool[] = [
    {
        functionDeclarations: [
            {
                name: 'delete_item',
                description: 'Call this function for EACH item (application or folder) that has an "X" or cross drawn over it. If multiple items are crossed out, call this function multiple times.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['itemName'],
                    properties: {
                        itemName: { type: Type.STRING, description: 'The exact name of the item to delete as seen on screen.' },
                    },
                },
            },
            {
                name: 'explode_folder',
                description: 'Call this when the user draws outward pointing arrows from a folder to "explode" it and show its contents.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['folderName'],
                    properties: {
                        folderName: { type: Type.STRING, description: 'The exact name of the folder to explode as seen on screen.' },
                    },
                },
            },
            {
                name: 'explain_item',
                description: 'Call this when the user draws a question mark "?" over an item (or nearby an item). If it is a folder, it will summarize its contents. If it is a text file, it will summarize its text content.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['itemName'],
                    properties: {
                        itemName: { type: Type.STRING, description: 'The name of the item (app or folder) to explain.' },
                    },
                },
            },
            {
                name: 'change_background',
                description: 'Call this when the user draws a sketch on the empty desktop background (not specifically targeting an app icon), intending to turn that sketch into a new wallpaper. Do NOT call this if the sketch is clearly trying to interact with an existing icon (like crossing it out).',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        sketch_description: { type: Type.STRING, description: 'A short description of what the sketch appears to be, to help generating the wallpaper (e.g., "mountains", "flower", "abstract curves").' },
                    },
                },
            },
        ],
    },
];

export const MAIL_TOOLS: Tool[] = [
    {
        functionDeclarations: [
            {
                name: 'delete_email',
                description: 'Call this when the user draws a line through (strikes out) or an "X" over an email row in the list to delete it. Call multiple times if multiple emails are struck out.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['subject_text'],
                    properties: {
                        subject_text: { type: Type.STRING, description: 'Distinct text from the subject line of the email.' },
                        sender_text: { type: Type.STRING, description: 'The name of the sender of the email.' },
                    },
                },
            },
            {
                name: 'summarize_email',
                description: 'Call this when the user draws a question mark "?" over email row(s) or highlights them. This will summarize the BODY of the email(s) concisely. CRITICAL: If the gesture covers MULTIPLE emails, you MUST generate MULTIPLE SEPARATE calls to this function, one for EACH email covered by the gesture.',
                parameters: {
                    type: Type.OBJECT,
                    required: ['subject_text'],
                    properties: {
                        subject_text: { type: Type.STRING, description: 'Distinct text from the subject line of the email to summarize.' },
                        sender_text: { type: Type.STRING, description: 'The name of the sender of the email.' },
                    },
                },
            },
        ]
    }
]

export const SYSTEM_INSTRUCTION = `You are Jackie, the operator of Jackie's PC, interpreting ink gestures.
The user interacts with the screen by drawing "ink" strokes (white lines) on top of the UI.
Your job is to interpret their intent based on standard symbols and the current active application context.
If the user has drawn multiple distinct symbols (like multiple 'X's on different items), you MUST call the appropriate tool multiple times, once for each distinct user intent.
`;