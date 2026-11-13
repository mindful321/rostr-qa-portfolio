"""RAG evals for Ask Rostr's handbook answers. Two layers, tested separately:

1. Retrieval: does /handbook/search rank the right document first, and never return an outdated one?
2. Generation: does the answer cite the right document, and is every sentence actually in the cited passage?

Cases come from golden_dataset.json (group "Handbook (RAG)").
"""
import json
import re
from pathlib import Path

import pytest

DATASET = json.loads((Path(__file__).parent / "golden_dataset.json").read_text(encoding="utf-8"))
POLICY_CASES = [c for c in DATASET["cases"] if c.get("expected_doc")]
IDS = [c["id"] for c in POLICY_CASES]


@pytest.fixture(scope="module")
def handbook(base_url):
    """Every handbook passage, keyed by (document id, section heading)."""
    import requests

    docs = requests.get(f"{base_url}/api/v1/handbook", timeout=15).json()["documents"]
    return {(d["id"], s["heading"]): {**s, "status": d["status"]} for d in docs for s in d["sections"]}


def search(api, q: str, k: int = 3):
    r = api.get("/handbook/search", params={"q": q, "k": k})
    assert r.status_code == 200, r.text
    return r.json()["results"]


# --- 1. Retrieval -------------------------------------------------------------------------------

@pytest.mark.parametrize("case", POLICY_CASES, ids=IDS)
def test_right_document_is_ranked_first(api, case):
    results = search(api, case["question"])
    assert results, f"Nothing retrieved for {case['question']!r}"
    assert results[0]["docId"] == case["expected_doc"], [(r["docId"], r["score"]) for r in results]


@pytest.mark.parametrize("case", POLICY_CASES, ids=IDS)
def test_retrieval_never_returns_superseded_policies(api, case):
    """An outdated policy is kept on file, but must never be used to answer."""
    results = search(api, case["question"], k=10)
    outdated = [r["docId"] for r in results if r["status"] != "current"]
    assert not outdated, f"Superseded documents retrieved: {outdated}"


def test_results_are_sorted_best_first(api):
    scores = [r["score"] for r in search(api, "Can I carry over unused vacation days?", k=5)]
    assert scores == sorted(scores, reverse=True)


def test_unrelated_question_retrieves_nothing(api):
    assert search(api, "What's the weather in Calgary?") == []


@pytest.mark.parametrize("params, code", [({}, "missing_query"), ({"q": "overtime", "k": 0}, "invalid_k"), ({"q": "overtime", "k": "abc"}, "invalid_k")])
def test_search_input_is_validated(api, params, code):
    r = api.get("/handbook/search", params=params)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == code


# --- 2. Generation: cited and grounded ----------------------------------------------------------

@pytest.mark.parametrize("case", POLICY_CASES, ids=IDS)
def test_answer_cites_the_expected_document(signed_in_api, case):
    data = signed_in_api.ask(case["question"]).json()
    assert data["intent"] == "policy"
    assert [c["docId"] for c in data["citations"]] == [case["expected_doc"]]


@pytest.mark.parametrize("case", POLICY_CASES, ids=IDS)
def test_answer_is_grounded_in_the_cited_passage(signed_in_api, handbook, case):
    """Every sentence of the answer must appear word for word in the passage it cites."""
    data = signed_in_api.ask(case["question"]).json()
    citation = data["citations"][0]
    passage = handbook[(citation["docId"], citation["heading"])]["text"]
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", data["answer"]) if s]
    unsupported = [s for s in sentences if s not in passage]
    assert not unsupported, f"Not in the cited passage ({citation['docId']} / {citation['heading']}): {unsupported}"


def test_no_citation_when_the_handbook_has_no_answer(signed_in_api):
    data = signed_in_api.ask("What's the dress code?").json()
    assert data["intent"] == "help"
    assert data["citations"] == []


def test_policy_question_about_pay_is_answered_but_personal_pay_is_refused(signed_in_api):
    """'How is overtime paid?' is a policy question; 'What is Dev paid?' is private."""
    assert signed_in_api.ask("How is overtime paid?").json()["intent"] == "policy"
    assert signed_in_api.ask("What is Dev paid?").json()["intent"] == "refusal"
