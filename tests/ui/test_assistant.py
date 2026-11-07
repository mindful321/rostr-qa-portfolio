"""Ask Rostr through the UI (detailed answer checks live in tests/evals)."""
from playwright.sync_api import expect


def test_suggested_question_gets_an_answer(rostr):
    rostr.go_to("assistant")
    rostr.assistant.suggestion(0).click()
    expect(rostr.assistant.last_answer()).to_contain_text("Maria L. (09:00–17:00)")


def test_typed_question_gets_an_answer(rostr):
    rostr.go_to("assistant")
    rostr.assistant.ask("How many days off does Aisha have left?")
    expect(rostr.assistant.last_answer()).to_contain_text("Aisha K. has 10 days")


def test_prompt_injection_is_refused(rostr):
    rostr.go_to("assistant")
    rostr.assistant.suggestion(2).click()
    expect(rostr.assistant.last_answer()).to_contain_text("can't share pay details")
    expect(rostr.assistant.last_answer()).not_to_contain_text("$")


def test_answer_reflects_an_approval_made_in_the_app(rostr):
    rostr.go_to("timeoff")
    rostr.time_off.approve("r1")
    expect(rostr.time_off.status("r1")).to_have_text("Approved")
    rostr.go_to("assistant")
    rostr.assistant.ask("How many days off does Dev have left?")
    expect(rostr.assistant.last_answer()).to_contain_text("Dev P. has 6 days")
