// Minimal static server for local preview. Mirrors Vercel's cleanUrls: /privacy -> privacy/index.html.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4500);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain",
};

async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const candidates = [clean, join(clean, "index.html"), `${clean}.html`];
  for (const c of candidates) {
    const file = join(root, c);
    if (!file.startsWith(root)) continue;
    try { if ((await stat(file)).isFile()) return file; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(req.url || "/");
  if (!file) { res.writeHead(404); res.end("not found"); return; }
  const body = await readFile(file);
  const type = types[extname(file)] || "application/octet-stream";
  if (req.headers.range && type === "video/mp4") {
    const [s, e] = req.headers.range.replace("bytes=", "").split("-").map(Number);
    const end = Number.isFinite(e) && e > 0 ? e : body.length - 1;
    res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${s}-${end}/${body.length}`, "Content-Length": end - s + 1 });
    res.end(body.subarray(s, end + 1));
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": body.length });
  res.end(body);
}).listen(port, () => console.log(`http://localhost:${port}`));
