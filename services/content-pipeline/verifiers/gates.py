"""
Deterministic pre-LLM gates for the Decifer Learning content pipeline.

These run before any model call, cost nothing, and cannot fail open. They exist
because the checks below are too important to leave to a model's judgement:

  sensitivity   — age-appropriateness of the *context* a question is dressed in
  structure     — distractor count, answer-in-distractors, hint/explanation shape
  containment   — stems that reference a source, image, or table the child never sees
  markup        — cloze placeholders, stray markdown, duplicated inline option blocks

WHY THE SENSITIVITY GATE EXISTS (2026-08-03):
40 published primary-maths questions used the transatlantic slave trade and WWII
casualty figures as arithmetic dressing — e.g. a Year 3 fractions question about
"450 enslaved people ... three-fifths worked in the fields". The arithmetic was
correct in every case, so Stage 2 passed them. Stage 4's constitution does carry a
"no upsetting content" line, but it is evaluated by a small model that also fails
open on a timeout, and its subject-bleed rule only runs one way (arithmetic inside a
non-Maths subject), so Maths-wearing-history-costume had no rule at all.

Age-appropriateness must not be a model judgement call. It is data.

Returns (passed: bool, violations: list[str]). Never raises.
"""
from __future__ import annotations

import re
from typing import Any

GATES_VERSION = "1.0.0"

# ── Key stages ────────────────────────────────────────────────────────────
# Duplicated deliberately from config.YEAR_KEY_STAGE: gates must be importable
# and testable without a database or a configured environment.
_YEAR_KEY_STAGE: dict[str, str] = {
    "year-1": "KS1", "year-2": "KS1",
    "year-3": "KS2", "year-4": "KS2", "year-5": "KS2", "year-6": "KS2",
    "year-7": "KS3", "year-8": "KS3", "year-9": "KS3",
    "year-10": "KS4", "year-11": "KS4",
}


def _key_stage(year_label: str) -> str:
    return _YEAR_KEY_STAGE.get((year_label or "").strip().lower(), "")


# ── Sensitive contexts ────────────────────────────────────────────────────
# SCOPE, AND WHY IT IS NARROW.
#
# The defect this catches is not "the question mentions something grim". History
# and English are supposed to teach the grim things: a Year 5 comprehension
# passage about Harriet Tubman, a Year 4 question about who made up a third of
# Athens, Justine's execution in Frankenstein — all legitimate, all valuable.
#
# The defect is *quantifying human suffering as an arithmetic exercise*. A Year 3
# fractions question whose numbers are counts of enslaved people is wrong no
# matter how correct the division is, because the subject being assessed is
# fractions and the suffering is set dressing.
#
# A first draft of this gate also tested "does the topic title own the theme?"
# for every subject. It fired on the UK's 2025 population (a "million people"
# pattern), on Ethelred's coronation date, and on a Frankenstein plot question —
# ~30 false positives out of 52 hits. That test is now gone. An automatic,
# irreversible retire needs near-zero false positives, so this gate only blocks
# what it can be sure about and leaves judgement calls to human review.

_SENSITIVE_THEMES: tuple[dict[str, Any], ...] = (
    {
        "name": "slavery",
        "pattern": re.compile(
            r"\benslav\w*|\bslave\b|\bslaves\b|\bslavery\b|\bslave trade\b|"
            r"\bmiddle passage\b|\btriangular trade\b",
            re.I,
        ),
    },
    {
        # Deaths must be counted, not merely mentioned. "70 million people died"
        # matches; "the population reached 37 million people" does not.
        "name": "war_casualties",
        "pattern": re.compile(
            r"\bcasualt\w+|\bdeath toll\b|\bwar dead\b|"
            r"[\d,.]+\s*(?:million\s+)?(?:people|men|women|children|civilians|soldiers|troops)"
            r"\s+(?:were\s+)?(?:died|killed|dead|lost their lives|perished)|"
            r"\b(?:lost|losing)\s+(?:about\s+|around\s+|roughly\s+)?[\d,.]+\s*(?:million\s+)?"
            r"(?:people|men|soldiers|troops|lives)\b|"
            # "How many soldiers were lost during 1916?" — the subtraction IS the death count.
            r"\b(?:people|men|women|children|civilians|soldiers|troops|lives)\s+(?:were\s+)?lost\b|"
            r"\bhow many\s+(?:\w+\s+){0,3}?(?:died|were killed|were lost)\b",
            re.I,
        ),
    },
    {
        "name": "genocide",
        "pattern": re.compile(
            r"\bgenocide\b|\bholocaust\b|\bconcentration camps?\b|\bdeath camps?\b|"
            r"\bextermination\b|\bethnic cleansing\b",
            re.I,
        ),
    },
    {
        "name": "execution_and_torture",
        "pattern": re.compile(
            r"\bexecut(?:ed|ion|ions)\b|\bbeheaded\b|\bburned at the stake\b|"
            r"\btortur\w+\b|\bguillotine\b",
            re.I,
        ),
    },
    {
        "name": "abuse_and_self_harm",
        "pattern": re.compile(
            r"\bsuicide\b|\bself[- ]harm\w*\b|\bsexual abuse\b|\bchild abuse\b|"
            r"\brape\b|\brapist\b",
            re.I,
        ),
    },
)

_KEY_STAGE_ORDER = {"KS1": 1, "KS2": 2, "KS3": 3, "KS4": 4}

# Maths is the whole point of the gate: a maths question's numbers must never be
# a body count. Science shares the problem for the same reason.
_QUANTIFYING_SUBJECTS = {"maths", "mathematics", "science"}

# Themes so severe that no primary question should carry them incidentally,
# in any subject. Deliberately short — these are the ones with no KS1/KS2
# curriculum home at all.
_NEVER_IN_PRIMARY = {"genocide", "abuse_and_self_harm"}


def check_sensitivity(question_data: dict, topic: dict) -> tuple[bool, list[str]]:
    """Block human suffering used as arithmetic filler, and the most severe
    themes appearing incidentally in primary content.

    Deliberately does NOT judge whether a History or English topic "should" cover
    a theme. That is a curriculum decision for a person, not a regex.
    """
    violations: list[str] = []

    haystack = " ".join(
        str(question_data.get(f) or "")
        for f in ("question_text", "correct_answer", "explanation",
                  "hint_1", "hint_2", "hint_3")
    )
    distractors = question_data.get("distractors")
    if isinstance(distractors, list):
        haystack += " " + " ".join(str(d) for d in distractors)

    subject = (topic.get("subject_name") or "").strip().lower()
    title = topic.get("title") or ""
    year = topic.get("year_group_label") or ""
    ks = _key_stage(year)
    ks_rank = _KEY_STAGE_ORDER.get(ks, 0)
    is_primary = 0 < ks_rank <= _KEY_STAGE_ORDER["KS2"]

    for theme in _SENSITIVE_THEMES:
        if not theme["pattern"].search(haystack):
            continue

        if subject in _QUANTIFYING_SUBJECTS:
            violations.append(
                f"sensitive_context:{theme['name']}: human suffering used as the "
                f"numbers in a {subject} question ({year}, topic {title!r}) — the "
                f"skill being assessed is {subject}, so the context is set dressing"
            )
            continue

        if is_primary and theme["name"] in _NEVER_IN_PRIMARY:
            violations.append(
                f"sensitive_context:{theme['name']}: appears in primary content "
                f"({year}/{ks}, {subject} topic {title!r})"
            )

    return (not violations), violations


# ── Structural gate ───────────────────────────────────────────────────────

_GENERIC_HINT_2 = "Rule out any options you are sure are wrong first."


def check_structure(question_data: dict) -> tuple[bool, list[str]]:
    """Shape checks the single-answer MCQ UI depends on."""
    violations: list[str] = []

    distractors = question_data.get("distractors")
    if not isinstance(distractors, list):
        violations.append("structure: distractors is not a list")
        distractors = []
    elif len(distractors) < 3:
        violations.append(f"structure: {len(distractors)} distractors, need 3")

    answer = str(question_data.get("correct_answer") or "").strip()
    if not answer:
        violations.append("structure: correct_answer is empty")
    else:
        lowered = {str(d).strip().lower() for d in distractors}
        if answer.lower() in lowered:
            violations.append("structure: correct_answer also appears in distractors")

    if len({str(d).strip().lower() for d in distractors}) != len(distractors):
        violations.append("structure: duplicate distractors")

    # Answer/distractor type mismatch.
    # Found 2026-08-04: "Put these fractions in order from smallest to largest"
    # was keyed to "0" while its three options were orderings, and "Which
    # description matches this move?" was keyed to "0" against three worded
    # descriptions. In both the keyed answer is not one of the options, so every
    # child is marked wrong whatever they pick. A bare number against worded
    # options (or the reverse) is always a broken row — and unlike "is the answer
    # right?", it costs nothing to detect.
    if answer and distractors:
        def _is_number(value: str) -> bool:
            return bool(re.fullmatch(r"[-−]?\d+(?:[.,]\d+)?", str(value).strip()))

        answer_numeric = _is_number(answer)
        distractor_numeric = [_is_number(d) for d in distractors]
        if distractor_numeric and answer_numeric != all(distractor_numeric) \
                and answer_numeric != any(distractor_numeric):
            violations.append(
                f"structure: answer {answer!r} is a bare number but the options are "
                f"worded (or the reverse) — the keyed answer is not one of the choices"
            )

    for field in ("hint_1", "hint_2", "hint_3"):
        if not str(question_data.get(field) or "").strip():
            violations.append(f"structure: {field} is empty")

    explanation = str(question_data.get("explanation") or "").strip()
    if len(explanation) < 25:
        violations.append("structure: explanation is missing or too short to teach anything")
    elif explanation.lower().startswith("the correct answer is:"):
        violations.append("structure: explanation is a stub that only restates the answer")

    if question_data.get("hint_2") == _GENERIC_HINT_2:
        violations.append("structure: placeholder hints never replaced with real ones")

    return (not violations), violations


# ── Self-containment gate ─────────────────────────────────────────────────
# A stem that points at material the child cannot see is unanswerable, however
# true its answer is. String surgery cannot repair these — they need regenerating.

# Two tiers, because a containment failure leads to an irreversible retire.
#
# HIGH: the stem points at a specific artefact that is unambiguously not here.
#       "the coordinate marked on this grid" cannot be answered without the grid.
# LOW:  the phrasing *might* be an orphan reference, or might be ordinary English.
#       "A shape has 5 sides. What is the name of this shape?" defines its own
#       shape. "Which part of a P-E-E paragraph gives a quote from the text?" is a
#       question about writing technique, not about a missing passage. These are
#       reported for a person to look at, never retired automatically.

_ORPHAN_SOURCE_HIGH = re.compile(
    r"according to the sources?\b|the source material\b|in the sources?\b|"
    r"the (?:text|passage|extract) above\b|the source shown\b|this source\b",
    re.I,
)
_ORPHAN_VISUAL_HIGH = re.compile(
    r"shown (?:below|above)\b|(?:below|above):|"
    r"\bthis (?:diagram|graph|chart|grid|number line|array|bar model|timeline)\b|"
    r"\bthe (?:diagram|graph|chart|timeline|photograph) (?:shown|below|above)\b|"
    r"\blook at the (?:diagram|picture|image|graph|chart|map|grid|table)\b|"
    r"\bhighlighted\b|\bshaded\b|\bbar model\b|"
    r"\bmatch the picture\b|\bthe picture (?:shown|below|above)\b",
    re.I,
)
_ORPHAN_LOW = re.compile(
    r"\bthis (?:shape|picture|image|map|table|photograph)\b|"
    r"\bthe (?:diagram|picture|image|graph|chart|map)\b|"
    r"from the (?:text|passage|extract)\b",
    re.I,
)
# "Which of these shapes has three sides?" is ordinary multiple-choice phrasing:
# "these" points at the options the UI renders, not at a missing picture. Only
# treat a bare "these <things>" as an orphan when it is NOT that construction.
_OPTION_DEIXIS = re.compile(r"which (?:one )?of (?:these|the following)\b", re.I)
_BARE_THESE = re.compile(
    r"\bthese (?:parts|shapes|numbers|objects|cards|counters|blocks|images|pictures)\b",
    re.I,
)
# A stem that carries its own passage is self-contained. Detect a quoted run or a
# multi-line block substantial enough to be the stimulus itself.
_INLINE_QUOTE = re.compile(r"[\"'“”](.{60,})[\"'“”]", re.S)


def _carries_own_stimulus(stem: str) -> bool:
    if _INLINE_QUOTE.search(stem):
        return True
    # "Read this short passage:\n\n<the passage>\n\nWhat is ...?"
    if "\n\n" in stem and len(stem) > 180:
        return True
    return False


def check_self_contained(question_data: dict) -> tuple[bool, list[str]]:
    """Reject stems referencing material not carried with the question.

    Material counts as carried when it is attached (question_metadata.stimulus_text,
    foundation_images, table_json) OR printed inline in the stem itself — most
    comprehension questions quote their passage directly in question_text.
    """
    violations: list[str] = []
    stem = str(question_data.get("question_text") or "")

    meta = question_data.get("question_metadata")
    meta = meta if isinstance(meta, dict) else {}
    has_stimulus = bool(
        str(meta.get("stimulus_text") or "").strip()
        or question_data.get("foundation_images")
        or meta.get("table_json")
    ) or _carries_own_stimulus(stem)

    if not has_stimulus:
        if _ORPHAN_SOURCE_HIGH.search(stem):
            violations.append(
                "containment: stem cites a source the child cannot see and no stimulus is attached"
            )
        if _ORPHAN_VISUAL_HIGH.search(stem):
            violations.append(
                "containment: stem refers to a visual the child cannot see and no image is attached"
            )
        elif _ORPHAN_LOW.search(stem) or (
            # "What are these pictures called?" describes a concept; "Count these
            # counters" needs the counters. Regex cannot tell them apart — review.
            _BARE_THESE.search(stem) and not _OPTION_DEIXIS.search(stem)
        ):
            violations.append(
                "containment_review: stem may reference material that is not attached — "
                "needs a person to decide, do not retire automatically"
            )

    if stem.rstrip().endswith(":"):
        violations.append("containment: stem ends mid-sentence — its content was elsewhere")

    return (not violations), violations


# ── Markup gate ───────────────────────────────────────────────────────────
# Extends the existing Stage-6 renderability check with the specific defects
# measured across the published corpus on 2026-08-03.

_MD_TABLE = re.compile(r"\|[^|\n]*\|")
_HTML = re.compile(r"<(?:table|tr|td|th|div|span|br|p|img)\b", re.I)
# Whitespace-tolerant: the Oak importer's _clean() only replaced the bare "{{}}",
# so lessons using "{{ }}" shipped with literal braces in the stem.
_CLOZE = re.compile(r"\{\{\s*\}\}")
_MD_EMPHASIS = re.compile(r"\*\*|__")
# An A)/B)/C)/D) block inside the stem duplicates the option list the UI renders.
_INLINE_OPTIONS = re.compile(r"\n\s*[A-D]\)\s", re.S)


def check_markup(question_data: dict) -> tuple[bool, list[str]]:
    violations: list[str] = []
    fields = {"question_text": str(question_data.get("question_text") or "")}
    distractors = question_data.get("distractors")
    if isinstance(distractors, list):
        fields["distractors"] = " ".join(str(d) for d in distractors)
    fields["correct_answer"] = str(question_data.get("correct_answer") or "")

    for name, text in fields.items():
        if _MD_TABLE.search(text):
            violations.append(f"markup: pipe-delimited table in {name} renders as literal text")
        if _HTML.search(text):
            violations.append(f"markup: raw HTML in {name}")
        if _CLOZE.search(text):
            violations.append(f"markup: unconverted cloze placeholder in {name}")
        if _MD_EMPHASIS.search(text):
            violations.append(f"markup: markdown emphasis in {name} renders as literal asterisks")

    if _INLINE_OPTIONS.search(fields["question_text"]):
        violations.append("markup: options listed inside the stem and again as choices")

    return (not violations), violations


# ── Entry point ───────────────────────────────────────────────────────────

def run_all(question_data: dict, topic: dict) -> tuple[bool, list[str]]:
    """Run every deterministic gate. Returns (passed, violations).

    Fails closed by construction: there is no model call to time out, and an
    unexpected exception propagates rather than being swallowed into a pass.
    """
    violations: list[str] = []
    for check in (
        lambda: check_sensitivity(question_data, topic),
        lambda: check_structure(question_data),
        lambda: check_self_contained(question_data),
        lambda: check_markup(question_data),
    ):
        _, found = check()
        violations.extend(found)
    return (not violations), violations


# ── Tests ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    passed = failed = 0

    def check(label, data, topic, expect_pass, expect_substr=None):
        global passed, failed
        ok, violations = run_all(data, topic)
        good = (ok == expect_pass)
        if good and expect_substr:
            good = any(expect_substr in v for v in violations)
        if good:
            passed += 1
            print(f"  PASS  {label}")
        else:
            failed += 1
            print(f"  FAIL  {label}: passed={ok} violations={violations}")

    def q(**kw):
        base = {
            "question_text": "What is 7 x 8?",
            "correct_answer": "56",
            "distractors": ["54", "63", "48"],
            "hint_1": "Think about the eight times table.",
            "hint_2": "Seven eights is close to seven tens minus seven twos.",
            "hint_3": "It is between 50 and 60.",
            "explanation": "Seven multiplied by eight is fifty-six, which is 7 lots of 8.",
        }
        base.update(kw)
        return base

    MATHS_Y3 = {"subject_name": "Maths", "title": "Number: Fractions", "year_group_label": "year-3"}
    HIST_Y8 = {"subject_name": "History", "title": "Empire, Slavery and Abolition",
               "year_group_label": "year-8"}
    HIST_Y2 = {"subject_name": "History", "title": "Changes Within Living Memory",
               "year_group_label": "year-2"}
    HIST_Y9 = {"subject_name": "History", "title": "World War Two: Causes and Legacy",
               "year_group_label": "year-9"}

    ENG_Y5 = {"subject_name": "English", "title": "Reading: Summarising and Retrieving Information",
              "year_group_label": "year-5"}
    HIST_Y4G = {"subject_name": "History", "title": "Ancient Greece: Life and Achievements",
                "year_group_label": "year-4"}
    GEOG_Y7 = {"subject_name": "Geography", "title": "Population and Urbanisation",
               "year_group_label": "year-7"}
    MATHS_Y8 = {"subject_name": "Maths", "title": "Number: Fractions, Decimals and Percentages",
                "year_group_label": "year-8"}

    print("\nSensitivity gate — the defect it exists for")
    check("clean maths question passes", q(), MATHS_Y3, True)
    check(
        "Y3 fractions dressed in slavery is blocked",
        q(question_text="Historians estimate that around 450 enslaved people were held on a "
                        "sugar plantation in the Caribbean. Three-fifths of them worked in the "
                        "fields. How many people worked in the fields?",
          correct_answer="270", distractors=["180", "150", "225"]),
        MATHS_Y3, False, "sensitive_context:slavery",
    )
    check(
        "Y3 maths with WWII casualty figures is blocked",
        q(question_text="The Soviet Union lost about 27 million people in total. Of these, "
                        "8 million were soldiers. How many were civilians?",
          correct_answer="19 million", distractors=["35 million", "21 million", "17 million"]),
        MATHS_Y3, False, "sensitive_context:war_casualties",
    )
    check(
        "secondary maths is blocked too — age is not the issue, the framing is",
        q(question_text="Historians estimate that around 12 million enslaved Africans were "
                        "transported across the Atlantic. If this is split equally across 4 "
                        "centuries, how many per century?",
          correct_answer="3 million", distractors=["4 million", "2 million", "6 million"]),
        MATHS_Y8, False, "sensitive_context:slavery",
    )
    check(
        "genocide in primary English is blocked",
        q(question_text="Which word describes the concentration camps of the Second World War?",
          correct_answer="Terrible", distractors=["Cheerful", "Ordinary", "Tiny"]),
        ENG_Y5, False, "appears in primary content",
    )

    print("\nSensitivity gate — regressions (all of these were false positives in v0)")
    check(
        "Y8 History on abolition is allowed",
        q(question_text="Which Act ended the transatlantic slave trade in the British Empire?",
          correct_answer="The Slave Trade Act 1807",
          distractors=["The Reform Act 1832", "The Factory Act 1833", "The Corn Laws"]),
        HIST_Y8, True,
    )
    check(
        "Y9 History on WWII deaths is allowed",
        q(question_text="Roughly how many people died during the Second World War?",
          correct_answer="About 70 million",
          distractors=["About 7 million", "About 700,000", "About 700 million"]),
        HIST_Y9, True,
    )
    check(
        "Y5 English comprehension about Harriet Tubman is allowed",
        q(question_text="Read this passage: 'Harriet Tubman was born into slavery in the United "
                        "States in the early 1820s. She escaped in 1849 and led others to "
                        "freedom.' When did Harriet Tubman escape?",
          correct_answer="1849", distractors=["1820", "1865", "1776"]),
        ENG_Y5, True,
    )
    check(
        "Y4 History on Athenian society is allowed",
        q(question_text="What type of people made up around a third of the population of Athens?",
          correct_answer="Enslaved people",
          distractors=["Soldiers", "Farmers", "Sailors"]),
        HIST_Y4G, True,
    )
    check(
        "a population figure is not a casualty figure",
        q(question_text="In 1801, Britain had a population of about 10 million people. By 1901 it "
                        "had grown to about 37 million. How many more people lived there in 1901?",
          correct_answer="27 million", distractors=["17 million", "47 million", "10 million"]),
        MATHS_Y3, True,
    )
    check(
        "the UK's current population is not a casualty figure",
        q(question_text="What is the approximate population of the UK in 2025?",
          correct_answer="About 69 million",
          distractors=["About 6 million", "About 690 million", "About 9 million"]),
        GEOG_Y7, True,
    )
    check(
        "a Frankenstein plot question is allowed",
        q(question_text="In Mary Shelley's 'Frankenstein', which character is wrongly tried and "
                        "executed for the murder of Victor's brother William?",
          correct_answer="Justine Moritz",
          distractors=["Elizabeth Lavenza", "Henry Clerval", "Caroline Beaufort"]),
        HIST_Y8 | {"subject_name": "English", "title": "Reading: 19th-Century Fiction"}, True,
    )
    check(
        "KS1 history about the past is allowed",
        q(question_text="What is a portrait?",
          correct_answer="A painting or photograph of a person",
          distractors=["A painting of a building", "A kind of map", "A type of song"]),
        HIST_Y2, True,
    )

    print("\nStructure gate")
    check("two distractors is blocked", q(distractors=["54", "63"]), MATHS_Y3, False,
          "2 distractors")
    check("answer inside distractors is blocked", q(distractors=["56", "63", "48"]),
          MATHS_Y3, False, "also appears in distractors")
    check("stub explanation is blocked", q(explanation="The correct answer is: 56."),
          MATHS_Y3, False, "stub")
    check("placeholder hints are blocked",
          q(hint_2="Rule out any options you are sure are wrong first."),
          MATHS_Y3, False, "placeholder hints")
    check("a bare number keyed against worded options is blocked",
          q(question_text="Put these fractions in order from smallest to largest: 1/2, 1/4, 3/4. "
                          "Which order is correct?",
            correct_answer="0",
            distractors=["3/4, 1/2, 1/4", "1/2, 1/4, 3/4", "3/4, 1/4, 1/2"]),
          MATHS_Y3, False, "not one of the choices")
    check("a genuine numeric zero against numeric options passes",
          q(question_text="Lily has 6 sweets. She eats 6 sweets. How many does she have left?",
            correct_answer="0", distractors=["1", "6", "12"]),
          MATHS_Y3, True)
    check("worded answer against worded options passes",
          q(question_text="How many corners does a circle have?",
            correct_answer="None", distractors=["One", "Two", "Seven"]),
          MATHS_Y3, True)

    print("\nContainment gate")
    check("orphan source reference is blocked",
          q(question_text="According to the sources, why did the population grow?"),
          MATHS_Y3, False, "cites a source")
    check("bare 'these parts' goes to review, not to automatic retirement",
          q(question_text="Sam thinks these parts can be combined to make a whole cake. "
                          "Is Sam right?"),
          MATHS_Y3, False, "containment_review")
    check("an explicit missing artefact is retire-grade",
          q(question_text="Look at the grid below. What are the coordinates of point A?",
            correct_answer="(2, 5)", distractors=["(5, 2)", "(2, 2)", "(5, 5)"]),
          MATHS_Y3, False, "refers to a visual")
    check("stimulus attached makes a passage question legal",
          q(question_text="According to the sources, why did the population grow?",
            question_metadata={"stimulus_text": "The UK population grew because ..."}),
          MATHS_Y3, True)
    check("dangling stem is blocked", q(question_text="Work out the total of these numbers:"),
          MATHS_Y3, False)
    check("'Which of these shapes' points at the options, not a picture",
          q(question_text="Which of these shapes has exactly 3 sides and 3 vertices?",
            correct_answer="Triangle", distractors=["Square", "Pentagon", "Hexagon"]),
          MATHS_Y3, True)
    check("'Which of the following numbers' is fine too",
          q(question_text="Which of the following numbers, when rounded to the nearest 100, "
                          "gives 400?",
            correct_answer="378", distractors=["340", "451", "299"]),
          MATHS_Y3, True)
    check("a passage quoted inline in the stem is self-contained",
          q(question_text="Read this short passage:\n\n\"Maya walked into the classroom and sat "
                          "down at her desk. She kept looking at the door and tapping her "
                          "fingers on the table.\"\n\nHow is Maya most likely feeling?",
            correct_answer="Nervous", distractors=["Bored", "Sleepy", "Angry"]),
          MATHS_Y3, True)
    check("a genuine missing diagram is still blocked",
          q(question_text="Select the correct notation of the coordinate marked on this grid.",
            correct_answer="(3, 4)", distractors=["(4, 3)", "(3, 3)", "(4, 4)"]),
          MATHS_Y3, False, "refers to a visual")

    print("\nMarkup gate")
    check("unconverted spaced cloze is blocked",
          q(question_text="Which word best completes this sentence: \"{{ }} Owen and Beck "
                          "present the reality of trench warfare.\""),
          MATHS_Y3, False, "cloze")
    check("markdown emphasis is blocked",
          q(question_text="Vector **a** = (4, 2). What is **a** doubled?"),
          MATHS_Y3, False, "emphasis")
    check("pipe table is blocked",
          q(question_text="Read the table: | Name | Score | and find the highest."),
          MATHS_Y3, False, "table")
    check("duplicated inline options are blocked",
          q(question_text="Which change happened?\nA) Melting\nB) Boiling\nC) Freezing\nD) None"),
          MATHS_Y3, False, "options listed inside the stem")

    print(f"\n{passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)
