// GET /api/v1/handbook                   -> the handbook documents (current and superseded, clearly marked)
// GET /api/v1/handbook/search?q=..&k=3   -> ranked passages for a question (the retrieval step of RAG)
// Public: the handbook isn't private, so no sign-in needed.
import { HANDBOOK } from "../lib/handbook.ts";
import { search } from "../lib/retrieval.ts";
import { error, json, methodNotAllowed } from "../lib/http.ts";
import { isBugMode } from "../lib/bugs.ts";

export default async (req: Request, context: { params?: Record<string, string> }): Promise<Response> => {
  if (req.method !== "GET") return methodNotAllowed(["GET"]);

  if (context.params?.action === "search") {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) return error(400, "missing_query", "Add a question: ?q=...");
    if (q.length > 300) return error(400, "query_too_long", "Keep questions under 300 characters.");
    const k = Number(url.searchParams.get("k") ?? 3);
    if (!Number.isInteger(k) || k < 1 || k > 10) return error(400, "invalid_k", "k must be a whole number from 1 to 10.");
    return json({ query: q, results: search(q, { k, bug: isBugMode(req) }) });
  }

  if (context.params?.action) return error(404, "not_found", "Use /api/v1/handbook or /api/v1/handbook/search.");
  return json({ documents: HANDBOOK });
};

export const config = { path: ["/api/v1/handbook", "/api/v1/handbook/:action"] };
