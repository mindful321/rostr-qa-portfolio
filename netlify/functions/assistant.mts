// GET  /api/v1/assistant              -> suggested questions
// POST /api/v1/assistant { question } -> scripted answer from the visitor's data
import { error, json, methodNotAllowed, readJson, withSession } from "../lib/http.ts";
import { SUGGESTED_QUESTIONS, answer } from "../lib/assistant.ts";

export default async (req: Request): Promise<Response> =>
  withSession(req, async (state) => {
    if (req.method === "GET") return json({ suggestions: SUGGESTED_QUESTIONS });
    if (req.method !== "POST") return methodNotAllowed(["GET", "POST"]);
    const body = await readJson(req);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return error(400, "missing_question", "Ask a question.");
    if (question.length > 300) return error(400, "question_too_long", "Keep questions under 300 characters.");
    return json({ question, ...answer(question, state) });
  });

export const config = { path: "/api/v1/assistant" };
