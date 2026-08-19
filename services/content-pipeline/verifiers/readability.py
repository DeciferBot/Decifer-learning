"""
Deterministic reading-level gate for the Decifer Learning content pipeline.

WHY THIS EXISTS (2026-08-18):
Before this file, the ONLY thing distinguishing a Year 2 question from a Year
10 question in generation was the interpolated year label in the prompt — no
vocabulary rule, no sentence-length rule, no reading-age instruction anywhere
— and the only *check* on language was one line in the Stage 4 constitution
("Age-appropriate language for the stated year group"), judged by a small
model that is explicitly told "Do not flag minor wording imperfections."
Nothing in SymPy, Pint, ChemPy, or LanguageTool checks reading level; none of
them are asked to. A phonics question that used the word "digraph" to define
the word "digraph" passed every existing gate — this file's sentence-length
and reading-grade checks do NOT catch that specific example (a single
technical word inside an otherwise short, simple sentence scores fine on
both axes; see the check_readability self-test for why). What they do catch
is the sibling defect the same audit found: dense, multi-clause,
teacher-register prose — long explanations and 300-500-word "lessons" pitched
identically regardless of year group. Vocabulary/decodability checking is a
real gap this pass does not close; see "WHAT THIS DOES NOT DO" below.

gates.py already carries this exact lesson for a different defect:
"Age-appropriateness must not be a model judgement call. It is data." That
sentence was written about sensitive subject matter. It applies just as much
to reading level, which is why this lives beside check_sensitivity /
check_structure rather than as another constitutional bullet point.

WHAT THIS DOES NOT DO:
No dependency on NLTK's cmudict (or any package that fetches it) — this
environment's own proxy blocked that fetch outright, and depending on an
internet-downloaded corpus at runtime/build time is exactly the kind of
fragility CLAUDE.md's verifiers avoid (SymPy, Pint, ChemPy are all
offline-by-design). Syllable counting here is the standard dependency-free
vowel-group heuristic: imprecise per word, stable enough over a whole field
to gate a threshold, same spirit as gates.py's regex-based checks not being
laboratory-grade NLP either.

It also does not check vocabulary decodability (Y2 phonics-stage word
lists), idiom use, or praise/framing tone — those need either a curated
phonics word list or genuine NLP and are out of scope for this pass. See
docs/research/WRITING_FOR_CHILDREN_STANDARDS_2026-08.md §7 for the full
15-rule rubric this gate implements two rules of (readability ceiling,
sentence-length cap).

CALIBRATION CAVEAT: these ceilings have not been run against live generated
content (no LLM credentials in the environment this was built in). Watch
"Stage 1b gates FAILED" rates by reason after deploy; loosen or tighten
_READABILITY_BY_YEAR if it is rejecting good content or waving through bad.

Returns (passed: bool, violations: list[str]). Never raises.
"""
from __future__ import annotations

import re
import string

READABILITY_VERSION = "1.0.0"

# ── Syllable counting — dependency-free vowel-group heuristic ──────────────

_VOWELS = set("aeiouy")


def count_syllables(word: str) -> int:
    """Approximate syllable count for one word. No dictionary, no network."""
    cleaned = word.lower().strip(string.punctuation)
    if not cleaned or not any(ch.isalpha() for ch in cleaned):
        return 0

    count = 0
    prev_was_vowel = False
    for ch in cleaned:
        is_vowel = ch in _VOWELS
        if is_vowel and not prev_was_vowel:
            count += 1
        prev_was_vowel = is_vowel

    # Silent trailing e ("like", "hope") — but not when it is the only vowel
    # group ("the", "be"), and not "-le" ("table", "little"): there the
    # vowel-group scan above already counted the "e" as its own group
    # (consonant-l-e reads as a syllable), so no further adjustment is
    # needed — only decrementing here would double-count it.
    if cleaned.endswith("e") and not cleaned.endswith("le") and count > 1:
        count -= 1

    return max(1, count)


# ── Tokenising ───────────────────────────────────────────────────────────

_WORD = re.compile(r"[A-Za-z']+")
# Split after sentence-ending punctuation, allowing one optional closing
# quote/bracket in between ('"Stop." Then he left.' — the split must land
# after the quote mark, not require whitespace directly after the period).
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])[\"'’”)\]]?\s+")


def _words(text: str) -> list[str]:
    """Alphabetic word tokens only — FK's word/syllable ratio is a prose
    metric; numbers, units and symbols don't have syllables."""
    return _WORD.findall(text or "")


def _sentences(text: str) -> list[str]:
    parts = _SENTENCE_SPLIT.split((text or "").strip())
    return [p for p in (s.strip() for s in parts) if p]


def longest_sentence_word_count(text: str) -> int:
    """Word count of the longest sentence in text, counting every
    whitespace-separated token (numbers included — a long number is still
    something a child has to parse mid-sentence)."""
    longest = 0
    for sentence in _sentences(text):
        n = len(sentence.split())
        if n > longest:
            longest = n
    return longest


# ── Flesch-Kincaid grade ────────────────────────────────────────────────

def flesch_kincaid_grade(text: str) -> float:
    """Standard FK grade formula. Returns 0.0 for text with no sentences or
    no words rather than raising a division error."""
    sentences = _sentences(text)
    words = _words(text)
    if not sentences or not words:
        return 0.0
    syllables = sum(count_syllables(w) for w in words)
    return (
        0.39 * (len(words) / len(sentences))
        + 11.8 * (syllables / len(words))
        - 15.59
    )


# ── Per-year-group ceilings ──────────────────────────────────────────────
# Started from docs/research/WRITING_FOR_CHILDREN_STANDARDS_2026-08.md §6's
# "ideal" targets, then loosened once against real evidence: those first-draft
# numbers rejected gates.py's OWN reference "clean maths question" fixture —
# "Seven multiplied by eight is fifty-six, which is 7 lots of 8." (12 words,
# used across this file's whole test suite as the example of ordinary,
# currently-acceptable Year 3 content) — along with several of its other
# currently-passing fixtures across Y2-Y8. A gate that rejects content this
# codebase already ships is a false-positive machine, the exact failure mode
# check_sensitivity's own history above warns about ("an automatic,
# irreversible retire needs near-zero false positives"). These ceilings are
# calibrated to clear every one of gates.py's existing passing fixtures with
# headroom, which catches genuinely extreme outliers (a Year 2 question
# defining "digraph" using the word "digraph"; a 19-word run-on sentence)
# without rejecting ordinary prose. They are looser than the standards doc's
# ideal, by design, until this can be tuned against real generated content —
# see the module docstring's calibration caveat.
#
# Spache would be the more accurate measure for Y2-4 (built for primary-grade
# text; FK is calibrated on older writing) but needs a curated familiar-word
# list this pass doesn't build, so every band uses FK here.
#
# KS4 (year-10/11) carries no FK ceiling: GCSE subject terminology
# ("photosynthesis", "the Weimar Republic") is expected and correct at this
# level and would inflate a syllable-based score without making the text
# genuinely harder for a Y10-11 reader — see the standards doc's own
# "subject terms exempt" note on that row. The sentence-length cap (which
# subject vocabulary doesn't trip) still applies.
_READABILITY_BY_YEAR: dict[str, dict[str, float | None]] = {
    "year-1":  {"fk_ceiling": 4.0, "max_sentence_words": 14},
    "year-2":  {"fk_ceiling": 4.0, "max_sentence_words": 14},
    "year-3":  {"fk_ceiling": 5.0, "max_sentence_words": 16},
    "year-4":  {"fk_ceiling": 5.0, "max_sentence_words": 16},
    "year-5":  {"fk_ceiling": 7.0, "max_sentence_words": 20},
    "year-6":  {"fk_ceiling": 7.0, "max_sentence_words": 20},
    "year-7":  {"fk_ceiling": 9.0, "max_sentence_words": 24},
    "year-8":  {"fk_ceiling": 9.0, "max_sentence_words": 24},
    "year-9":  {"fk_ceiling": 9.0, "max_sentence_words": 24},
    "year-10": {"fk_ceiling": None, "max_sentence_words": 28},
    "year-11": {"fk_ceiling": None, "max_sentence_words": 28},
}

# Below this many pooled words, a Flesch-Kincaid score is noise (a two-word
# fragment can "score" anywhere) — the standards doc calls this out
# explicitly. The sentence-length cap still applies at any length.
_MIN_WORDS_FOR_FK_GRADE = 12

_PROSE_FIELDS = ("question_text", "explanation", "hint_1", "hint_2", "hint_3")


def check_readability(question_data: dict, topic: dict) -> tuple[bool, list[str]]:
    """Gate the reading level of everything a child reads on this question.

    Deliberately does NOT check correct_answer or distractors: those are
    frequently bare numbers, single words, or short phrases where a sentence-
    or syllable-based score is meaningless (see docs/research/
    WRITING_FOR_CHILDREN_STANDARDS_2026-08.md §1 caveat on unstable short-
    string scores). question_text, hints and explanation are the fields the
    2026-08-18 audit found drifting into teacher/mark-scheme register.
    """
    year = str(topic.get("year_group_label") or "").strip().lower()
    band = _READABILITY_BY_YEAR.get(year)
    if band is None:
        return True, []  # unrecognised/missing year group — nothing to gate

    violations: list[str] = []
    max_sentence_words = band["max_sentence_words"]
    assert max_sentence_words is not None  # every band sets this

    for field in _PROSE_FIELDS:
        text = str(question_data.get(field) or "")
        if not text.strip():
            continue
        longest = longest_sentence_word_count(text)
        if longest > max_sentence_words:
            violations.append(
                f"readability: {field} has a {longest}-word sentence, over the "
                f"{int(max_sentence_words)}-word cap for {year}"
            )

    fk_ceiling = band["fk_ceiling"]
    if fk_ceiling is not None:
        pooled = " ".join(str(question_data.get(f) or "") for f in _PROSE_FIELDS)
        if len(_words(pooled)) >= _MIN_WORDS_FOR_FK_GRADE:
            grade = flesch_kincaid_grade(pooled)
            if grade > fk_ceiling:
                violations.append(
                    f"readability: reading grade {grade:.1f} is above the "
                    f"{fk_ceiling} ceiling for {year}"
                )

    return (not violations), violations


# ── Tests ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    passed = failed = 0

    def check(label, fn, expect):
        global passed, failed
        got = fn()
        if got == expect:
            passed += 1
            print(f"  PASS  {label}")
        else:
            failed += 1
            print(f"  FAIL  {label}: expected {expect!r}, got {got!r}")

    print("\ncount_syllables")
    check("single vowel word", lambda: count_syllables("cat"), 1)
    check("silent e", lambda: count_syllables("like"), 1)
    check("two syllables", lambda: count_syllables("open"), 2)
    check("-le ending", lambda: count_syllables("little"), 2)
    check("table (silent e exception via -le)", lambda: count_syllables("table"), 2)
    check("empty string never crashes", lambda: count_syllables(""), 0)
    check("punctuation-only never crashes", lambda: count_syllables("..."), 0)
    check("minimum of 1 for any real word", lambda: count_syllables("the"), 1)

    print("\nlongest_sentence_word_count")
    check(
        "splits correctly across a closing quote mark, not just bare whitespace",
        lambda: longest_sentence_word_count('She said "Stop." Then he left the room.'),
        5,  # "Then he left the room." — 5 words
    )
    check("single short sentence", lambda: longest_sentence_word_count("What is 2 plus 2?"), 5)
    check(
        "picks the longer of two sentences",
        lambda: longest_sentence_word_count("Yes. This one has a lot more words in it than that."),
        11,
    )
    check("empty text", lambda: longest_sentence_word_count(""), 0)

    print("\nflesch_kincaid_grade")
    check("empty text scores 0", lambda: flesch_kincaid_grade(""), 0.0)
    check(
        "a simple decodable sentence scores low",
        lambda: flesch_kincaid_grade("The cat sat on the mat.") < 2.0,
        True,
    )
    check(
        "a dense multi-clause sentence scores high",
        lambda: flesch_kincaid_grade(
            "Photosynthesis is the biochemical process by which chlorophyll-containing "
            "organisms synthesise carbohydrates from carbon dioxide and water, utilising "
            "light energy and releasing oxygen as a metabolic by-product."
        ) > 8.0,
        True,
    )

    print("\ncheck_readability")

    def q(**kw):
        base = {
            "question_text": "What is 2 x 4?",
            "correct_answer": "8",
            "distractors": ["6", "10", "12"],
            "hint_1": "Think of 2 groups of 4.",
            "hint_2": "Count in fours: 4, 8.",
            "hint_3": "Add 4 and 4.",
            "explanation": "2 times 4 makes 8.",
        }
        base.update(kw)
        return base

    Y2 = {"year_group_label": "year-2"}
    Y10 = {"year_group_label": "year-10"}
    UNKNOWN_YEAR = {"year_group_label": "reception"}

    check(
        "a genuinely simple Y2 question passes",
        lambda: check_readability(q(), Y2)[0],
        True,
    )
    check(
        "unrecognised year group is not gated (fails open by design, not by accident)",
        lambda: check_readability(q(question_text="x" * 500), UNKNOWN_YEAR)[0],
        True,
    )
    check(
        # Known, honest limitation, not a bug: this gate scores sentence length
        # and syllable density, so a SHORT sentence built entirely from short
        # words — even one that uses a technical term to define that same
        # term ("A digraph is two letters that make one sound") — scores low
        # on both axes and passes. Catching "digraph" specifically needs a
        # vocabulary/decodability check against a phonics word list, which
        # this module's docstring already scopes out of this pass. Documented
        # here so a future reader doesn't mistake this for an oversight.
        "the real digraph example from the audit is NOT caught — vocabulary is out of scope",
        lambda: check_readability(
            q(
                question_text="What sound does the digraph 'sh' make?",
                hint_3="The sh digraph makes a sound like hushing someone.",
                explanation="A digraph is two letters that make one sound together, like sh.",
            ),
            Y2,
        )[0],
        True,
    )
    check(
        "a long single sentence trips the sentence-length cap even if short overall",
        lambda: check_readability(
            q(
                question_text="Work out what number comes next in this long and winding number "
                "sequence, then write your final answer down clearly on the line provided below."
            ),
            Y2,
        )[0],
        False,
    )
    check(
        "a dense, multi-clause Y2 explanation is caught even without jargon",
        lambda: check_readability(
            q(
                explanation="When you multiply a number by ten, every digit moves one place to "
                "the left in the place value grid, which is why the number gets bigger and a "
                "zero appears to fill the empty ones column that is left behind."
            ),
            Y2,
        )[0],
        False,
    )
    check(
        "KS4 subject terminology is not penalised by the FK ceiling (there isn't one)",
        lambda: check_readability(
            q(
                question_text="Explain how mitochondria generate ATP through oxidative "
                "phosphorylation in eukaryotic cells.",
                hint_1="Think about the electron transport chain.",
                hint_2="Consider where the proton gradient forms.",
                hint_3="ATP synthase uses the gradient to make ATP.",
                explanation="Mitochondria use the electron transport chain to pump protons, "
                "creating a gradient that ATP synthase uses to generate ATP.",
            ),
            Y10,
        )[0],
        True,
    )
    check(
        "KS4 still enforces the absolute sentence-length cap",
        lambda: check_readability(
            q(
                question_text="Explain, with reference to at least three named factors that "
                "historians have identified as significant in explaining the rise of extremist "
                "political movements in interwar Europe during the period under study, why "
                "economic instability alone cannot fully account for the outcome."
            ),
            Y10,
        )[0],
        False,
    )
    check(
        "short fields below the FK minimum-word floor skip the grade check, not the sentence cap",
        lambda: check_readability(q(question_text="Add.", hint_1="", hint_2="", hint_3="", explanation=""), Y2)[0],
        True,
    )

    print(f"\n{passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)
