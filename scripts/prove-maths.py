"""
Prove or disprove every published maths question by recomputing it.

THE POINT: the LLM never decides whether the answer is right. It only reads the
question and writes down the arithmetic. SymPy / safe-eval computes that
arithmetic and compares it to the keyed answer. Code decides. That is
CLAUDE.md §4.2, and it is the difference between an opinion and a proof.

Runs on the pipeline's existing DO DeepSeek route (config.GENERATION_MODEL) —
the same route the nightly crons already use. No Anthropic API calls.

WHY THIS IS NEEDED AT ALL
2,490 of 2,568 published maths rows carry no verifier version, and none carry the
verification_expression that verifiers/maths.py requires. That verifier fails
closed without it, so these rows could not have earned their score through
run_one. Whatever published them, nothing has ever recomputed them. Seven were
found wrong by hand on 2026-08-04; this settles the rest.

OUTCOMES, all recorded in question_metadata.maths_proof:
  proven      keyed answer equals the recomputed value      → stays published
  disproven   recomputed value differs                      → retired
  not_computable  no arithmetic to check (conceptual)       → left alone, counted
  unprovable  expression produced but would not evaluate    → left alone, counted

Resumable: rows already carrying maths_proof are skipped.

Usage:
  python3 scripts/prove-maths.py --limit 20 --dry-run     # look first
  python3 scripts/prove-maths.py --all                    # run to completion
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

_REPO = "/root/decifer-learning"

_e = subprocess.run(
    ["bash", "-c", f"set -a && source {_REPO}/.env.local && set +a && env"],
    capture_output=True, text=True,
).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k, v)

sys.path.insert(0, f"{_REPO}/services/content-pipeline")
import config  # noqa: E402
from pipeline import _llm_call, _extract_json  # noqa: E402
from verifiers import maths as maths_verifier  # noqa: E402

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402

MATHS_TYPES = ("maths_arithmetic", "maths_algebra", "maths_geometry", "maths_concept")

_PROMPT = """Read this maths question and write down the arithmetic needed to answer it.

Question: {question_text}

Do NOT tell me the answer. Write only the calculation, so that a computer can
evaluate it independently and check the answer for itself.

Respond with ONLY valid JSON, one of these three shapes:

If the question is answered by evaluating an expression:
{{"kind": "expression", "expression": "15 * 0.8829 / 0.9455", "unit": "cm"}}

If the question is answered by solving an equation for a variable:
{{"kind": "equation", "equation": "2*x + 3 - 11", "variable": "x"}}
(write the equation as an expression equal to zero at the solution)

If the question has no arithmetic — it asks for a definition, a shape name, a
term, a classification, or a judgement:
{{"kind": "none"}}

Rules:
- Use plain Python/SymPy syntax: * for multiply, ** for powers, sqrt(), pi, sin(), cos(), tan().
- Trigonometric functions take RADIANS. Convert degrees explicitly: sin(62*pi/180).
- Write the calculation from the numbers in the question, not from any answer you have in mind.
- If the question depends on a diagram, table or image you cannot see, answer {{"kind": "none"}}.
- If a multi-step question asks for one specific quantity, give the calculation for THAT quantity."""

_write_lock = threading.Lock()


_SUPERSCRIPT = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺", "0123456789-+")

# Answers that are not a single number. Comparing a scalar against these produced
# a run of false disproofs on 2026-08-04 — "6√2" read as 6, "200π cm³" as 200,
# "3.4 × 10⁶" as 3.4, "9 : 16" as 9, "y = −2x + 6" as −2. Every one of those rows
# was CORRECT and would have been retired. If the answer is not unambiguously one
# number, this returns None and the row is left alone rather than risked.
_NOT_SCALAR = re.compile(r":|≤|≥|<|>|,\s*\d|\band\b|\bor\b|\bbecause\b|\byes\b|\bno\b", re.I)


def _parse_number(text: str):
    """Evaluate an answer string to a single number, or None if it isn't one.

    Handles the forms that actually appear in the corpus: plain numbers with
    units ('17.3 cm', '£86'), fractions ('5/9'), surds ('6√2'), multiples of pi
    ('200π cm³'), and standard form ('3.4 × 10⁶', '5.02 × 10⁻³', '4.56\\times10^5').
    """
    if text is None:
        return None
    t = str(text).strip()

    # Strip LaTeX wrappers before anything else.
    t = t.replace("$$", " ").replace("\\text", " ").replace("\\!", "")
    t = re.sub(r"\\(?:times|cdot)", "*", t)
    t = re.sub(r"\\sqrt\s*\{([^}]*)\}", r"sqrt(\1)", t)
    t = re.sub(r"\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}", r"((\1)/(\2))", t)
    t = t.replace("\\pi", "pi").replace("{", " ").replace("}", " ").replace("\\", " ")

    # A superscript means two opposite things depending on what it follows:
    # an exponent after a number (10⁶ = 10**6) and a dimension after a unit
    # (cm³ = cubic centimetres, which must be discarded). Remove unit+superscript
    # pairs FIRST, then treat every remaining superscript as an exponent.
    t = re.sub(r"\b([a-zA-Z]{1,3})[²³⁴]", r"\1", t)
    t = re.sub(r"([\d)])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+)",
               lambda m: m.group(1) + "**(" + m.group(2).translate(_SUPERSCRIPT) + ")", t)
    t = t.translate(_SUPERSCRIPT)

    t = (t.replace("−", "-").replace("–", "-").replace("×", "*").replace("·", "*")
           .replace("π", "pi").replace("√", "sqrt").replace(",", "")
           .replace("£", "").replace("$", "").replace("%", "").replace("°", ""))

    if _NOT_SCALAR.search(t):
        return None
    # An equation as an answer ("y = -2x + 6") is not a scalar; a bare "x = 5" is.
    if "=" in t:
        rhs = t.split("=")[-1]
        if re.search(r"[a-zA-Z]", re.sub(r"(?:sqrt|pi)", "", rhs)):
            return None
        t = rhs

    t = t.replace("^", "**")
    # sqrt needs its argument bracketed: "6sqrt2" is not valid, "6*sqrt(2)" is.
    t = re.sub(r"sqrt\s*(\d+(?:\.\d+)?)", r"sqrt(\1)", t)
    t = re.sub(r"(\d)\s*(sqrt|pi)", r"\1*\2", t)
    t = re.sub(r"\)\s*(sqrt|pi)", r")*\1", t)

    # Whatever alphabetic tokens remain are units — drop them, keep the maths.
    t = re.sub(r"(?<![a-zA-Z])(?!sqrt|pi)[a-zA-Z]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip(" *")
    if not t or not re.search(r"\d", t):
        return None

    try:
        from sympy import sympify
        value = complex(sympify(t))
        if abs(value.imag) > 1e-9:
            return None
        return float(value.real)
    except Exception:
        return None


def _evaluate(spec: dict):
    """Evaluate the model's arithmetic with code. Returns (value, detail)."""
    kind = spec.get("kind")
    if kind == "expression":
        expr = (spec.get("expression") or "").strip()
        if not expr:
            return None, "empty expression"
        try:
            return maths_verifier.safe_eval(expr), expr
        except Exception:
            pass
        try:
            from sympy import sympify
            return float(sympify(expr)), expr
        except Exception as exc:
            return None, f"could not evaluate {expr!r}: {exc}"

    if kind == "equation":
        eq = (spec.get("equation") or "").strip()
        var = (spec.get("variable") or "x").strip() or "x"
        if not eq:
            return None, "empty equation"
        try:
            from sympy import symbols, solve
            from sympy.parsing.sympy_parser import parse_expr
            v = symbols(var)
            solutions = solve(parse_expr(eq, local_dict={var: v}), v)
            reals = []
            for s in solutions:
                try:
                    reals.append(float(s))
                except (TypeError, ValueError):
                    continue
            if not reals:
                return None, f"no real solution for {eq!r}"
            return reals, f"{eq} solved for {var}"
        except Exception as exc:
            return None, f"could not solve {eq!r}: {exc}"

    return None, "no arithmetic"


def prove(row: dict) -> dict:
    """Prove the row, and if it looks wrong, prove it again independently.

    A false "disproven" retires correct content permanently, so a single
    disagreement is never enough. The second pass asks for the arithmetic afresh;
    the row is only disproven when BOTH passes evaluate cleanly, agree with each
    other, and disagree with the keyed answer.
    """
    first = _prove_once(row)
    if first["verdict"] != "disproven":
        return first


    second = _prove_once(row)
    if second["verdict"] != "disproven":
        first["verdict"] = "contested"
        first["detail"] = (
            f"first pass disagreed ({first['detail']}), second pass said "
            f"{second['verdict']} — not retiring on a split decision"
        )
        return first

    a = first["computed"] if isinstance(first["computed"], list) else [first["computed"]]
    b = second["computed"] if isinstance(second["computed"], list) else [second["computed"]]
    agree = any(
        x is not None and y is not None and abs(x - y) <= max(0.05, abs(x) * 0.01)
        for x in a for y in b
    )
    if not agree:
        first["verdict"] = "contested"
        first["detail"] = (
            f"two passes disagreed with the key AND with each other "
            f"({a} vs {b}) — not retiring"
        )
        return first

    # Final discriminator, and the one that makes automatic retirement safe.
    #
    # A model asked for "the arithmetic" sometimes computes an intermediate value
    # instead of the quantity asked for: the unit share of a ratio rather than the
    # named angle, the boundary of an inequality rather than a value satisfying it.
    # Both passes make the same mistake, so agreement does not rule it out.
    #
    # But if the recomputed value equals one of the DISTRACTORS, the question is
    # internally coherent and the key is simply sitting on the wrong option — a
    # provable defect. If it matches nothing on the page, we cannot tell a broken
    # question from a mis-modelled one, so a person decides.
    distractors = row.get("distractors")
    if isinstance(distractors, str):
        try:
            distractors = json.loads(distractors)
        except Exception:
            distractors = []
    option_values = [_parse_number(d) for d in (distractors or [])]
    option_values = [v for v in option_values if v is not None]

    if option_values and any(_matches(a, opt) for opt in option_values):
        first["detail"] += (
            f"; confirmed by a second computation ({b}) and the recomputed value "
            f"is one of the offered options — the key is on the wrong option"
        )
        return first

    first["verdict"] = "needs_review"
    first["detail"] += (
        f"; second computation agreed ({b}) but the value matches no option on the "
        f"page, so the question may simply have been mis-modelled — left published"
    )
    return first


def _prove_once(row: dict) -> dict:
    """Returns {verdict, computed, keyed, detail}. Never raises."""
    keyed = _parse_number(row["correct_answer"])
    out = {"verdict": "not_computable", "computed": None,
           "keyed": keyed, "detail": "", "expression": ""}

    if keyed is None:
        out["detail"] = "keyed answer is not numeric"
        return out

    try:
        msg = _llm_call(
            prompt=_PROMPT.format(question_text=row["question_text"]),
            max_tokens=400,
            temperature=0,
        )
        spec = _extract_json(msg.content[0].text)
        spec = json.loads(spec) if isinstance(spec, str) else spec
    except Exception as exc:
        out["verdict"] = "unprovable"
        out["detail"] = f"could not obtain arithmetic: {exc}"
        return out

    if not isinstance(spec, dict) or spec.get("kind") == "none":
        out["detail"] = "model reports no arithmetic to check"
        return out

    value, detail = _evaluate(spec)
    out["expression"] = detail
    if value is None:
        out["verdict"] = "unprovable"
        out["detail"] = detail
        return out

    candidates = value if isinstance(value, list) else [value]
    out["computed"] = candidates[0] if len(candidates) == 1 else candidates
    if _matches(candidates, keyed):
        out["verdict"] = "proven"
    else:
        out["verdict"] = "disproven"
        out["detail"] = f"recomputed {candidates} but the answer is keyed {keyed}"
    return out


import math  # noqa: E402


def _matches(candidates: list, keyed: float) -> bool:
    """Compare with the tolerances real answers actually need.

    Beyond rounding, two unit conventions bite constantly:
      - trigonometry returns RADIANS while the keyed answer is in DEGREES
        (asin(3/5) = 0.6435 rad = 36.87 deg, keyed "37" — correct, not an error)
      - percentages keyed as "45" against a computed 0.45
    Treating either as a disagreement would retire correct content.
    """
    tolerance = max(0.05, abs(keyed) * 0.01)   # 1%, generous for rounded answers
    for c in candidates:
        if abs(c - keyed) <= tolerance:
            return True
        deg = math.degrees(c)
        if abs(deg - keyed) <= max(0.6, abs(keyed) * 0.01):
            return True
        if abs(c * 100 - keyed) <= max(0.5, abs(keyed) * 0.01):
            return True
        if abs(c / 100 - keyed) <= max(1e-4, abs(keyed) * 0.01):
            return True
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--no-retire", action="store_true",
                    help="record verdicts but do not retire disproven rows")
    args = ap.parse_args()

    conn = psycopg2.connect(config.DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT qq.id, qq.question_text, qq.correct_answer, qq.distractors,
               qq.question_type, yg.label AS year_group_label
        FROM quiz_questions qq
        JOIN topics t       ON t.id  = qq.topic_id
        JOIN year_groups yg ON yg.id = t.year_group_id
        WHERE qq.status = 'published'
          AND qq.question_type = ANY(%s)
          AND qq.question_metadata->'maths_proof' IS NULL
        ORDER BY md5(qq.id::text)
        %s
        """ % ("%s", "" if args.all else "LIMIT %s"),
        (list(MATHS_TYPES),) if args.all else (list(MATHS_TYPES), args.limit),
    )
    rows = cur.fetchall()
    print(f"Recomputing {len(rows)} maths questions via {config.GENERATION_MODEL} "
          f"(expression only) + SymPy (decides)\n", flush=True)
    if not rows:
        return 0

    verdicts: Counter = Counter()
    disproven: list = []
    done = 0

    write_cur = conn.cursor()

    def handle(row):
        return row, prove(row)

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [pool.submit(handle, r) for r in rows]
        for fut in as_completed(futures):
            row, result = fut.result()
            verdicts[result["verdict"]] += 1
            done += 1

            if result["verdict"] == "needs_review":
                print(f"  REVIEW    [{row['year_group_label']}] "
                      f"{(row['question_text'] or '')[:76]}", flush=True)
                print(f"            keyed {row['correct_answer']!r} | {result['detail'][:150]}",
                      flush=True)

            if result["verdict"] == "disproven":
                disproven.append((row, result))
                print(f"  DISPROVEN [{row['year_group_label']}] "
                      f"{(row['question_text'] or '')[:80]}", flush=True)
                print(f"            keyed {row['correct_answer']!r} | {result['detail']}",
                      flush=True)

            if done % 100 == 0:
                print(f"  ... {done}/{len(rows)}  {dict(verdicts)}", flush=True)

            if args.dry_run:
                continue

            proof = {
                "verdict": result["verdict"],
                "computed": result["computed"],
                "keyed": result["keyed"],
                "expression": result["expression"][:400],
                "detail": result["detail"][:300],
                "method": f"{config.GENERATION_MODEL}+sympy",
            }
            with _write_lock:
                write_cur.execute(
                    """
                    UPDATE quiz_questions
                       SET question_metadata = COALESCE(question_metadata, '{}'::jsonb)
                           || jsonb_build_object('maths_proof', %s::jsonb)
                     WHERE id = %s
                    """,
                    (json.dumps(proof), row["id"]),
                )

    print(f"\nVerdicts: {dict(verdicts)}")

    if disproven and not args.dry_run and not args.no_retire:
        ids = [str(r["id"]) for r, _ in disproven]
        with _write_lock:
            write_cur.execute(
                """
                UPDATE quiz_questions
                   SET status = 'retired',
                       question_metadata = COALESCE(question_metadata, '{}'::jsonb)
                       || jsonb_build_object(
                            'retired_reason', 'maths_proof_disproven',
                            'retired_by', 'prove-maths/sympy',
                            'retired_at', now()::text)
                 WHERE id = ANY(%s::uuid[]) AND status = 'published'
                """,
                (ids,),
            )
            print(f"Retired {write_cur.rowcount} disproven questions.")

    cur.execute(
        """
        SELECT COUNT(*) AS n FROM quiz_questions
        WHERE status='published' AND question_type = ANY(%s)
          AND question_metadata->'maths_proof' IS NULL
        """,
        (list(MATHS_TYPES),),
    )
    print(f"Maths questions still unproven: {cur.fetchone()['n']}")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
