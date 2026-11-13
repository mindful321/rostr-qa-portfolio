// BUG MODE. When a visitor's `bug_mode` cookie is "on", Rostr plants these 12 real defects.
// Each one is a small, clearly marked branch in the app code (search for "PLANTED BUG").
// The test suite must catch every one of them: that is the release gate.
import { readCookie } from "./session.ts";

export const PLANTED_BUGS = [
  { id: "BUG-01", area: "Login", summary: "A wrong password still signs you in" },
  { id: "BUG-02", area: "Schedule", summary: "Week dates are one day early" },
  { id: "BUG-03", area: "Schedule", summary: "An overlapping shift gets saved" },
  { id: "BUG-04", area: "Time off", summary: "Deny approves the request" },
  { id: "BUG-05", area: "Time off", summary: "Approved days come off Maria's balance, whoever asked" },
  { id: "BUG-06", area: "Timesheet", summary: "No overtime is paid after 40 hours" },
  { id: "BUG-07", area: "Timesheet", summary: "Cents are dropped from pay" },
  { id: "BUG-08", area: "API", summary: "GET /shifts?tz=America/Edmonton returns 500" },
  { id: "BUG-09", area: "Ask Rostr", summary: "Invents a shift for someone who doesn't work here" },
  { id: "BUG-10", area: "Ask Rostr", summary: "A prompt injection makes it reveal everyone's pay" },
  { id: "BUG-11", area: "Ask Rostr (RAG)", summary: "Retrieval returns an outdated, superseded policy" },
  { id: "BUG-12", area: "Ask Rostr (RAG)", summary: "Answers cite the wrong source document" },
] as const;

export function isBugMode(req: Request): boolean {
  return readCookie(req, "bug_mode") === "on";
}
