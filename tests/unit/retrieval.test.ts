// Unit tests for the handbook retrieval (BM25) and the extractive, cited answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { answerFromHandbook, search, stem, tokenize } from "../../netlify/lib/retrieval.ts";

test("tokenize: lower-case, drops stop words and possessives, stems plurals", () => {
  assert.deepEqual(tokenize("How many DAYS off does Dev's team get?"), ["many", "day", "off", "dev", "team"]);
});

test("stem: plurals, -ing, -ies and a few irregular forms", () => {
  assert.equal(stem("shifts"), "shift");
  assert.equal(stem("swapping"), "swap");
  assert.equal(stem("policies"), "policy");
  assert.equal(stem("paid"), "pay");
  assert.equal(stem("lunch"), "meal");
  assert.equal(stem("class"), "class"); // not "clas"
});

test("search: best passage first, scores descending", () => {
  const hits = search("How do I swap a shift?", { k: 5 });
  assert.equal(hits[0].docId, "shift-swaps");
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1].score >= hits[i].score);
});

test("search: superseded documents are excluded", () => {
  const hits = search("carry over unused vacation days", { k: 10 });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => h.status === "current"));
});

test("search: bug mode lets the outdated policy win (BUG-11)", () => {
  assert.equal(search("Can I carry over unused vacation days?", { bug: true })[0].docId, "pto-policy-2024");
});

test("search: nothing for an unrelated question", () => {
  assert.deepEqual(search("What's the weather in Calgary?"), []);
});

test("answer: quotes the top passage and cites it", () => {
  const a = answerFromHandbook("How is overtime paid?");
  assert.ok(a);
  assert.match(a.answer, /1\.5 times/);
  assert.deepEqual(a.citations.map((c) => c.docId), ["overtime-policy"]);
  assert.ok(a.hits[0].text.includes(a.answer.split(". ")[0]));
});

test("answer: null when nothing matches well enough", () => {
  assert.equal(answerFromHandbook("What's the dress code?"), null);
});

test("answer: bug mode cites the wrong passage (BUG-12)", () => {
  const a = answerFromHandbook("How do I swap a shift?", true);
  assert.ok(a);
  assert.notEqual(a.citations[0].docId, "shift-swaps");
});
