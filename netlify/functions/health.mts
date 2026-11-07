// GET /api/v1/health — smoke-check endpoint.
export default async (req: Request): Promise<Response> => {
  const bugMode = (req.headers.get("cookie") ?? "").includes("bug_mode=on");
  return Response.json({ status: "ok", app: "rostr", bugMode });
};

export const config = { path: "/api/v1/health" };
