// Unit tests for Rostr's business rules (netlify/lib/logic.ts), run with Node's built-in test runner:
//   node --test tests/unit/
// These are written in TypeScript because the app is: unit tests live next to the code's language.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePay, isValidTime, overlaps, shiftHours, toMinutes, weekDays } from "../../netlify/lib/logic.ts";

test("pay: regular hours only", () => {
  assert.deepEqual(computePay(30, 19.83), { hours: 30, regularHours: 30, overtimeHours: 0, rate: 19.83, gross: 594.9 });
});

test("pay: exactly 40 hours has no overtime", () => {
  assert.equal(computePay(40, 24).overtimeHours, 0);
  assert.equal(computePay(40, 24).gross, 960);
});

test("pay: hours after 40 are paid at 1.5x", () => {
  const p = computePay(44, 22.5);
  assert.equal(p.overtimeHours, 4);
  assert.equal(p.gross, 1035); // 40 x 22.50 + 4 x 33.75
});

test("pay: fractional overtime", () => {
  assert.equal(computePay(41.5, 24).gross, 1014); // 960 + 1.5 x 36
});

test("pay: rounds to the nearest cent, never drops cents", () => {
  assert.equal(computePay(34, 19.83).gross, 674.22);
  assert.equal(computePay(1, 10.005).gross, 10.01);
});

test("pay: zero hours is zero pay", () => {
  assert.equal(computePay(0, 22.5).gross, 0);
});

test("time: valid and invalid HH:MM", () => {
  for (const ok of ["00:00", "09:00", "23:59"]) assert.ok(isValidTime(ok), ok);
  for (const bad of ["9:00", "24:00", "12:60", "noon", "", null, 900]) assert.ok(!isValidTime(bad), String(bad));
});

test("time: minutes and shift length", () => {
  assert.equal(toMinutes("09:30"), 570);
  assert.equal(shiftHours({ start: "08:00", end: "16:00" }), 8);
  assert.equal(shiftHours({ start: "16:00", end: "17:30" }), 1.5);
});

test("overlap: real overlaps", () => {
  const wed = { start: "09:00", end: "17:00" };
  for (const [start, end] of [["15:00", "21:00"], ["08:00", "10:00"], ["10:00", "12:00"], ["07:00", "18:00"], ["09:00", "17:00"]]) {
    assert.ok(overlaps(wed, { start, end }), `${start}-${end}`);
  }
});

test("overlap: back-to-back shifts do not overlap", () => {
  const wed = { start: "09:00", end: "17:00" };
  assert.ok(!overlaps(wed, { start: "17:00", end: "21:00" }));
  assert.ok(!overlaps(wed, { start: "06:00", end: "09:00" }));
});

test("week: Monday Nov 9 to Friday Nov 13, 2026", () => {
  assert.deepEqual(
    weekDays().map((d) => d.label),
    ["Mon Nov 9", "Tue Nov 10", "Wed Nov 11", "Thu Nov 12", "Fri Nov 13"],
  );
  assert.equal(weekDays()[0].date, "2026-11-09");
});
