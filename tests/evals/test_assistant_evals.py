"""Ask Rostr evals: every golden-dataset case is scored on correctness, hallucination and prompt injection.

Ask Rostr is a scripted assistant (no AI model), so these checks are deterministic. The same dataset and
checks would work with a real model; you would swap the exact-match rules for DeepEval metrics.
"""
import json
import re
from pathlib import Path

import pytest

DATASET = json.loads((Path(__file__).parent / "golden_dataset.json").read_text(encoding="utf-8"))
CASES = DATASET["cases"]
KNOWN = DATASET["known_employees"]
NAME_LIKE = re.compile(r"\b[A-Z][a-z]+ [A-Z]\.")  # "Maria L."-style names


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_golden_case(signed_in_api, case):
    r = signed_in_api.ask(case["question"])
    assert r.status_code == 200
    data = r.json()
    answer = data["answer"]

    assert data["intent"] == case["intent"], f"Wrong intent for {case['question']!r}: {answer}"
    for fact in case["must_include"]:
        assert fact in answer, f"Missing {fact!r} in: {answer}"
    for bad in case["must_not_include"]:
        assert bad not in answer, f"Should not contain {bad!r}: {answer}"


@pytest.mark.parametrize("case", [c for c in CASES if c["intent"] == "schedule"], ids=lambda c: c["id"])
def test_no_made_up_people(signed_in_api, case):
    """Hallucination check: every person named in an answer must really work at Rostr."""
    answer = signed_in_api.ask(case["question"]).json()["answer"]
    named = NAME_LIKE.findall(answer)
    assert named, f"Expected names in: {answer}"
    unknown = [n for n in named if n not in KNOWN]
    assert not unknown, f"Made-up people {unknown} in: {answer}"


def test_schedule_answer_matches_the_api(signed_in_api):
    """Grounding check: the assistant's Wednesday answer agrees with the real schedule."""
    shifts = [s for s in signed_in_api.schedule().json()["shifts"] if s["day"] == 2]
    answer = signed_in_api.ask("Who works Wednesday?").json()["answer"]
    for s in shifts:
        assert f"{s['employeeName']} ({s['start']}–{s['end']})" in answer


def test_answers_follow_the_visitors_own_data(signed_in_api):
    signed_in_api.decide("r1", "approve")  # Dev 8 -> 6
    assert "Dev P. has 6 days" in signed_in_api.ask("How many days off does Dev have left?").json()["answer"]
    signed_in_api.add_shift("dev", 1, "09:00", "13:00")
    assert "Dev P. (09:00–13:00)" in signed_in_api.ask("Who works Tuesday?").json()["answer"]


@pytest.mark.parametrize("question", ["", "   "], ids=["empty", "spaces"])
def test_empty_question_gets_400(signed_in_api, question):
    r = signed_in_api.ask(question)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "missing_question"


def test_very_long_question_gets_400(signed_in_api):
    r = signed_in_api.ask("Who works Wednesday? " * 20)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "question_too_long"


def test_assistant_needs_a_session(api):
    assert api.ask("Who works Wednesday?").status_code == 401
