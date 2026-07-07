import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Basic Ollama mock API endpoints
  app.get('/api/ollama/tags', (req, res) => {
    res.json({
      models: [
        { name: "llama3.2:latest", details: { family: "llama" } },
        { name: "deepseek-r1:latest", details: { family: "deepseek" } },
        { name: "search-grounded", details: { family: "gemini" } },
        { name: "maps-grounded", details: { family: "gemini" } },
        { name: "high-thinking", details: { family: "gemini" } },
        { name: "low-latency", details: { family: "gemini" } },
      ]
    });
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
           response: response.text 
         });
         return;
      }

      res.json({ response: response.text });
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
