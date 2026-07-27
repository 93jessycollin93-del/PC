import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = { ".css": "text/css", ".js": "text/javascript", ".html": "text/html" };

function reply(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8` });
  res.end(body);
}

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { message = "" } = JSON.parse(body);
      // The proxy boundary keeps provider credentials off the browser; configure the real
      // model call here when deploying a provider-backed instance.
      const text = `I’m here with you. I heard: “${String(message).slice(0, 500)}”\n\nLet’s give that thought a little room, then choose one clear next step.`;
      reply(res, 200, JSON.stringify({ message: text }));
    } catch {
      reply(res, 400, JSON.stringify({ error: "Please send a valid message." }));
    }
    return;
  }

  const requested = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const path = normalize(join(root, requested));
  if (!path.startsWith(root)) return reply(res, 403, "Forbidden", "text/plain");
  try {
    reply(res, 200, await readFile(path), types[extname(path)] || "application/octet-stream");
  } catch {
    reply(res, 404, "Not found", "text/plain");
  }
}).listen(port, () => console.log(`Jackie Playground: http://localhost:${port}`));
