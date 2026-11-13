// Retrieval for Ask Rostr: BM25 keyword ranking over the handbook (no AI model, no cost).
// The answer is EXTRACTIVE: it quotes the best-matching sentences from the top passage and cites it,
// so every claim can be traced back to a source. That is what the grounding tests check.
import { HANDBOOK } from "./handbook.ts";

export type Passage = {
  docId: string;
  title: string;
  heading: string;
  text: string;
  status: "current" | "superseded";
  effective: string;
};
export type SearchHit = Passage & { score: number };
export type Citation = Pick<Passage, "docId" | "title" | "heading" | "status">;

const STOPWORDS = new Set(
  ("a an and are as at be by can could do does for from get got how i if in into is it its me my " +
    "of on or our should so than that the their them then there these they this to us was we what " +
    "when where which who will with would you your yours").split(" "),
);

/** Lower-case words, stop words removed, light stemming ("days" -> "day", "swapping" -> "swap"). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

// A few irregular forms so "paid" finds "pay" and "worked" finds "work".
const IRREGULAR: Record<string, string> = { paid: "pay", worked: "work", approved: "approve", lunch: "meal" };

export function stem(w: string): string {
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3).replace(/(.)\1$/, "$1");
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Every handbook section is one passage. */
export const PASSAGES: Passage[] = HANDBOOK.flatMap((d) =>
  d.sections.map((s) => ({ docId: d.id, title: d.title, heading: s.heading, text: s.text, status: d.status, effective: d.effective })),
);

const K1 = 1.2;
const B = 0.75;
// The heading counts twice: it says what the passage is about.
const passageTokens = PASSAGES.map((p) => tokenize(`${p.heading} ${p.heading} ${p.text}`));
const avgLength = passageTokens.reduce((n, t) => n + t.length, 0) / passageTokens.length;
const docFreq = new Map<string, number>();
for (const tokens of passageTokens) for (const t of new Set(tokens)) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);

function idf(term: string): number {
  const n = docFreq.get(term) ?? 0;
  return Math.log(1 + (PASSAGES.length - n + 0.5) / (n + 0.5));
}

/** BM25 score of each passage for the query. */
function bm25(query: string): number[] {
  const terms = [...new Set(tokenize(query))];
  return passageTokens.map((tokens) => {
    let score = 0;
    for (const term of terms) {
      const tf = tokens.filter((t) => t === term).length;
      if (!tf) continue;
      score += idf(term) * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * tokens.length) / avgLength)));
    }
    return score;
  });
}

/** Passages that matched at least one query word, best first. Outdated (superseded) documents are left out. */
export function search(query: string, opts: { k?: number; bug?: boolean } = {}): SearchHit[] {
  const { k = 3, bug = false } = opts;
  const scores = bm25(query);
  return PASSAGES.map((p, i) => ({ ...p, score: Math.round(scores[i] * 1000) / 1000 }))
    // PLANTED BUG-11: in bug mode, superseded documents are NOT filtered out, so an outdated policy can win.
    .filter((hit) => hit.score > 0 && (bug || hit.status === "current"))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export const MIN_SCORE = 1.5; // below this, the best passage is too weak a match to answer from

export type GroundedAnswer = { answer: string; citations: Citation[]; hits: SearchHit[] } | null;

/** Answers from the top passage by quoting its most relevant sentences, or returns null if nothing matches well. */
export function answerFromHandbook(question: string, bug = false): GroundedAnswer {
  const hits = search(question, { k: 3, bug });
  const top = hits[0];
  if (!top || top.score < MIN_SCORE) return null;

  const terms = new Set(tokenize(question));
  const sentences = top.text.split(/(?<=[.!?])\s+/);
  const ranked = sentences
    .map((s, i) => ({ s, i, overlap: tokenize(s).filter((t) => terms.has(t)).length }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.i - b.i)
    .slice(0, 2)
    .sort((a, b) => a.i - b.i);
  const answer = (ranked.length ? ranked.map((x) => x.s) : [sentences[0]]).join(" ");

  // PLANTED BUG-12: in bug mode, the answer is quoted from the top passage but CITES the second one.
  const cited = bug && hits[1] ? hits[1] : top;
  const citation: Citation = { docId: cited.docId, title: cited.title, heading: cited.heading, status: cited.status };
  return { answer, citations: [citation], hits };
}
