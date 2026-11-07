// Local stand-in for Netlify: serves site/ and routes /api/* to netlify/functions/*.mts,
// matching each function's `config.path` the way Netlify does. No extra packages needed.
// Usage: node scripts/dev-server.mjs [port]        (Node 22.18+ / 23.6+ for TypeScript support)
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const SITE = join(ROOT, "site");
const FUNCTIONS = join(ROOT, "netlify", "functions");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8888);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".pdf": "application/pdf", ".json": "application/json", ".png": "image/png",
  ".ico": "image/x-icon", ".woff2": "font/woff2",
};

async function loadRoutes() {
  const routes = [];
  for (const file of await readdir(FUNCTIONS)) {
    if (!/\.m?ts$/.test(file)) continue;
    const mod = await import(pathToFileURL(join(FUNCTIONS, file)).href);
    const paths = [mod.config?.path ?? `/.netlify/functions/${file.replace(/\.m?ts$/, "")}`].flat();
    for (const p of paths) routes.push({ file, pattern: new URLPattern({ pathname: p }), handler: mod.default });
  }
  return routes;
}

async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length && !["GET", "HEAD"].includes(req.method) ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body });
}

async function send(res, response) {
  const headers = {};
  response.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(pathname, res) {
  let file = normalize(join(SITE, decodeURIComponent(pathname)));
  if (!file.startsWith(SITE)) return send(res, new Response("Forbidden", { status: 403 }));
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    // Netlify "pretty URLs": /demo -> /demo.html
    file = file.endsWith(".html") ? file : `${file}.html`;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    await send(res, new Response("Not found", { status: 404 }));
  }
}

const routes = await loadRoutes();
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    for (const r of routes) {
      const m = r.pattern.exec({ pathname: url.pathname });
      if (!m) continue;
      const params = Object.fromEntries(Object.entries(m.pathname.groups).filter(([, v]) => v !== undefined));
      const response = await r.handler(await toRequest(req), { params });
      console.log(`${req.method} ${url.pathname} -> ${response.status} (${r.file})`);
      return send(res, response);
    }
    await serveStatic(url.pathname, res);
  } catch (err) {
    console.error(err);
    await send(res, Response.json({ error: { code: "server_error", message: "Something went wrong." } }, { status: 500 }));
  }
}).listen(PORT, () => {
  console.log(`Rostr dev server on http://localhost:${PORT}  (${routes.length} API routes)`);
});
