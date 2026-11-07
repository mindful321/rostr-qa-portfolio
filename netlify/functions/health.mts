// GET /api/v1/health — smoke-check endpoint so API tests have something to hit from day one.
export default async (req: Request): Promise<Response> => {
  const bugMode = (req.headers.get("cookie") ?? "").includes("bug_mode=on");
  return Response.json({ status: "ok", app: "rostr", bugMode });
};
