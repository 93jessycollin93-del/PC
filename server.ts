import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 5000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Real model listing. If a real Ollama instance is configured via
  // OLLAMA_ENDPOINT, proxy its real /api/tags. Otherwise, honestly report
  // the real Gemini-backed routes this server actually serves — no fake
  // hardcoded model catalog.
  app.get('/api/ollama/tags', async (req, res) => {
    const endpoint = process.env.OLLAMA_ENDPOINT;
    if (endpoint) {
      try {
        const url = endpoint.endsWith('/') ? `${endpoint}api/tags` : `${endpoint}/api/tags`;
        const headers: Record<string, string> = {};
        if (process.env.OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
        const r = await fetch(url, { headers });
        if (!r.ok) throw new Error(`Ollama responded with ${r.status}`);
        const data = await r.json();
        return res.json(data);
      } catch (err) {
        return res.status(502).json({ models: [], error: `Real Ollama endpoint unreachable: ${String(err)}` });
      }
    }
    // No real local Ollama configured — say so, don't fabricate a model list.
    res.json({ models: [], error: 'No OLLAMA_ENDPOINT configured — no local models available.' });
  });

  app.post('/api/ollama/generate', async (req, res) => {
    try {
      const { model, prompt, stream, options } = req.body;
      let geminiModel = 'gemini-3.5-flash';
      const config: any = {
        temperature: options?.temperature || 0.7,
      };

      if (model.includes('reasoning') || model.includes('deepseek') || model.includes('high thinking')) {
        geminiModel = 'gemini-3.1-pro-preview';
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else if (model.includes('lightweight') || model.includes('flash lite') || model.includes('low-latency')) {
        geminiModel = 'gemini-3.1-flash-lite';
      } else if (model.includes('search')) {
        geminiModel = 'gemini-3.5-flash';
        config.tools = [{ googleSearch: {} }];
      } else if (model.includes('maps')) {
        geminiModel = 'gemini-3.5-flash';
        config.tools = [{ googleMaps: {} }];
      }

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config
      });

      res.json({
        model: geminiModel,
        response: response.text,
        done: true
      });
    } catch (err) {
      console.error("Gemini proxy error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // Generic proxy for other apps if needed
  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const response = await ai.models.generateContent({
        model: model || 'gemini-3.5-flash',
        contents,
        config
      });
      
      // If tool calls exist, send them
      if (response.functionCalls) {
         res.json({ 
           functionCalls: response.functionCalls, 
           response: response.text,
           usageMetadata: response.usageMetadata,
         });
         return;
      }

      res.json({ response: response.text, usageMetadata: response.usageMetadata });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  // Real Ollama Hardware Integration
  app.post('/api/ollama/real', async (req, res) => {
    try {
      const { model, messages, stream, options, customEndpoint, customApiKey } = req.body;
      const endpoint = customEndpoint || process.env.OLLAMA_ENDPOINT;
      const apiKey = customApiKey || process.env.OLLAMA_API_KEY;
      
      if (!endpoint) {
        return res.status(400).json({ error: 'OLLAMA_ENDPOINT is not configured.' });
      }

      const ollamaUrl = endpoint.endsWith('/') ? `${endpoint}api/chat` : `${endpoint}/api/chat`;
      const targetModel = process.env.OLLAMA_MODEL || model || 'llama3';
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(ollamaUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: targetModel, messages, stream: false, options })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      // Map to standard response format expected by frontend
      res.json({ response: data.message?.content || '' });
    } catch (err) {
      console.error("Local Ollama error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // Telegram Integration
  app.post('/api/telegram/send', async (req, res) => {
    try {
      const { text, chat_id } = req.body;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN is not configured.' });
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text })
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Telegram send error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/telegram/updates', async (req, res) => {
    try {
      const { offset } = req.query;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
         // Return empty if not configured so the app doesn't break
        return res.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
      }

      const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
      if (offset) url.searchParams.append('offset', String(offset));
      
      const response = await fetch(url.toString());
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Telegram getUpdates error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // Real, whitelisted shell command execution for AiTermApp. Runs actual
  // child processes in this container — no fabricated output. `args` is an
  // array (never a raw shell string) to avoid injection.
  const SHELL_WHITELIST: Record<string, true> = {
    ls: true, pwd: true, cat: true, whoami: true, date: true, uname: true,
    ps: true, df: true, git: true, docker: true, du: true, echo: true,
  };
  app.post('/api/shell/exec', async (req, res) => {
    try {
      const { cmd, args, cwd } = req.body as { cmd: string; args?: string[]; cwd?: string };
      if (!cmd || !SHELL_WHITELIST[cmd]) {
        return res.status(400).json({ error: `Command not permitted: ${cmd}` });
      }
      const safeArgs = Array.isArray(args) ? args.filter(a => typeof a === 'string') : [];
      // Also block any arg that tries to climb out of the workspace via '..'.
      if (safeArgs.some(a => a.includes('..'))) {
        return res.status(400).json({ error: 'Path traversal is not permitted' });
      }
      const options: any = { timeout: 8000, maxBuffer: 2 * 1024 * 1024, cwd: process.cwd() };
      if (cwd) {
        const resolved = path.resolve(process.cwd(), '.' + path.sep + cwd.replace(/^\/+/, ''));
        if (!resolved.startsWith(process.cwd())) {
          return res.status(400).json({ error: 'cwd outside workspace is not permitted' });
        }
        options.cwd = resolved;
      }
      const { stdout, stderr } = await execFileAsync(cmd, safeArgs, options);
      res.json({ stdout, stderr });
    } catch (err: any) {
      res.status(200).json({ stdout: err.stdout || '', stderr: err.stderr || String(err.message || err), error: true });
    }
  });

  // Real build runner for BuildVaultApp — actually runs `npm run build` in
  // this container and returns the real stdout/stderr and exit status.
  app.post('/api/build/run', async (req, res) => {
    const start = Date.now();
    try {
      const { stdout, stderr } = await execFileAsync('npm', ['run', 'build'], {
        cwd: process.cwd(),
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });
      res.json({ success: true, stdout, stderr, durationMs: Date.now() - start });
    } catch (err: any) {
      res.json({ success: false, stdout: err.stdout || '', stderr: err.stderr || String(err.message || err), durationMs: Date.now() - start });
    }
  });

  // Real provider health checks for ModelRouterApp — actually reaches each
  // provider's API instead of reporting a hardcoded status.
  app.post('/api/health/providers', async (req, res) => {
    const { keys } = req.body as { keys?: Record<string, string> };
    const results: Record<string, { ok: boolean; detail?: string }> = {};

    // Gemini — uses the server's own configured key, real request.
    try {
      await ai.models.generateContent({ model: 'gemini-3.1-flash-lite', contents: 'ping' });
      results.gemini = { ok: true };
    } catch (e: any) {
      results.gemini = { ok: false, detail: String(e.message || e) };
    }

    const checks: { name: string; url: string; headerKey?: string }[] = [
      { name: 'groq', url: 'https://api.groq.com/openai/v1/models' },
      { name: 'deepseek', url: 'https://api.deepseek.com/models' },
      { name: 'anthropic', url: 'https://api.anthropic.com/v1/models' },
    ];
    for (const c of checks) {
      const key = keys?.[c.name];
      if (!key) { results[c.name] = { ok: false, detail: 'No API key configured' }; continue; }
      try {
        const headers: Record<string, string> = c.name === 'anthropic'
          ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
          : { Authorization: `Bearer ${key}` };
        const r = await fetch(c.url, { headers });
        results[c.name] = { ok: r.ok, detail: r.ok ? undefined : `HTTP ${r.status}` };
      } catch (e: any) {
        results[c.name] = { ok: false, detail: String(e.message || e) };
      }
    }
    res.json(results);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
