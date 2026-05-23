"""
Physics verifier for Decifer Learning content pipeline.

Stage 2: code verification — CLAUDE.md §9.
  science_physics_calculation → AST-only safe-eval (no raw eval)

Physical constants available in expressions:
  pi  — 3.14159…
  e   — 2.71828…
  g   — 9.81 (gravitational acceleration, m/s²)
  c   — 299_792_458 (speed of light, m/s)
  h   — 6.626e-34 (Planck constant, J·s)

Returns (verified: bool, detail: str). Never raises; failures return False + reason.

Safety: reject ast.Call, ast.Attribute, ast.Subscript, imports, unknown names,
and exponents > 100 (prevent DoS via 1**1000).
"""

from __future__ import annotations

import ast
import math
import operator
import re
from typing import Tuple

VERIFIER_VERSION = "1.0.0"

# ── Whitelist ─────────────────────────────────────────────────────────────

_SAFE_OPS = {
    ast.Add:      operator.add,
    ast.Sub:      operator.sub,
    ast.Mult:     operator.mul,
    ast.Div:      operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod:      operator.mod,
    ast.Pow:      operator.pow,
    ast.USub:     operator.neg,
    ast.UAdd:     operator.pos,
}

_SAFE_NAMES: dict[str, float] = {
    "pi": math.pi,
    "e":  math.e,
    "g":  9.81,
    "c":  299_792_458.0,
    "h":  6.626e-34,
}

# Allowed SI-ish unit strings (validated against this set; unknown units fail)
_ALLOWED_UNITS = {
    "m", "km", "cm", "mm",
    "s", "ms",
    "kg", "g", "mg",
    "m/s", "km/h", "m/s^2",
    "N", "J", "W", "Pa", "Hz",
    "K", "°C",
    "A", "V", "Ω",
    "mol",
    "m^2", "cm^2", "km^2",
    "m^3", "cm^3", "L", "mL",
    "",  # dimensionless
}


# ── AST evaluator ─────────────────────────────────────────────────────────

def _eval_node(node: ast.expr) -> float:
    """Walk the AST, applying only whitelisted operations and constants.

    Raises ValueError for any disallowed construct so the caller can
    catch and return (False, reason).
    """
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return float(node.value)
        raise ValueError(f"non-numeric constant: {node.value!r}")

    if isinstance(node, ast.Name):
        name = node.id
        if name in _SAFE_NAMES:
            return _SAFE_NAMES[name]
        raise ValueError(f"unknown name: {name!r} — only {sorted(_SAFE_NAMES)!r} are allowed")

    if isinstance(node, ast.BinOp):
        fn = _SAFE_OPS.get(type(node.op))
        if fn is None:
            raise ValueError(f"unsupported operator: {type(node.op).__name__}")
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        if isinstance(node.op, ast.Pow):
            if abs(right) > 100:
                raise ValueError(f"exponent too large: {right}")
        return fn(left, right)

    if isinstance(node, ast.UnaryOp):
        fn = _SAFE_OPS.get(type(node.op))
        if fn is None:
            raise ValueError(f"unsupported unary op: {type(node.op).__name__}")
        return fn(_eval_node(node.operand))

    # Reject any other node type unconditionally
    raise ValueError(
        f"disallowed AST node: {type(node).__name__!r} — "
        "only constants, whitelisted names, and arithmetic operators are allowed"
    )


def safe_eval_physics(expression: str) -> float:
    """Evaluate a physics expression using the AST whitelist. Never calls eval()."""
    if not expression or len(expression) > 200:
        raise ValueError("expression empty or too long (max 200 chars)")
    try:
        tree = ast.parse(expression.strip(), mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"syntax error: {exc}") from exc

    # Extra guard: reject any Call, Attribute, or Subscript node anywhere in the tree
    for node in ast.walk(tree):
        if isinstance(node, (ast.Call, ast.Attribute, ast.Subscript)):
            raise ValueError(
                f"disallowed AST node in expression: {type(node).__name__!r}"
            )
        if isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom):
            raise ValueError("import statements are not allowed")

    return _eval_node(tree.body)


# ── Answer parser ─────────────────────────────────────────────────────────

_NUMERIC_RE = re.compile(r"=?\s*(-?[\d.]+(?:e[+-]?\d+)?)")


def _parse_numeric(answer: str) -> float:
    s = answer.strip()
    # Handle "x = 5.0 m/s" or "= 4.9 m/s²" patterns
    m = _NUMERIC_RE.search(s)
    if m:
        return float(m.group(1))
    raise ValueError(f"cannot parse numeric from {answer!r}")


# ── Main verify function ──────────────────────────────────────────────────

def verify(question_data: dict) -> Tuple[bool, str]:
    """
    Stage 2 Physics verification.

    Expects question_data to include:
      question_type              : "science_physics_calculation"
      correct_answer             : string with the expected numeric answer (may include units)
      verification_expression    : arithmetic expression evaluating to the expected answer
      verification_unit          : (optional) expected SI unit string

    Returns (verified: bool, detail: str).
    """
    qtype = question_data.get("question_type", "")
    if qtype != "science_physics_calculation":
        return False, f"Physics verifier does not handle question_type={qtype!r}"

    expr = question_data.get("verification_expression", "").strip()
    if not expr:
        return False, "verification_expression is missing or empty"

    # Validate unit if provided
    unit = (question_data.get("verification_unit") or "").strip()
    if unit and unit not in _ALLOWED_UNITS:
        return False, (
            f"Unknown unit {unit!r}. Allowed units: {sorted(_ALLOWED_UNITS - {''})!r}"
        )

    # Evaluate expression via AST (never eval())
    try:
        computed = safe_eval_physics(expr)
    except ValueError as exc:
        return False, f"verification_expression error: {exc}"

    # Parse expected answer
    correct_answer = question_data.get("correct_answer", "")
    try:
        expected = _parse_numeric(str(correct_answer))
    except ValueError as exc:
        return False, f"correct_answer parse error: {exc}"

    # Numeric tolerance: 0.1% relative or 1e-9 absolute
    tolerance = max(abs(expected) * 0.001, 1e-9)
    if abs(computed - expected) > tolerance:
        return False, (
            f"verification_expression evaluates to {computed:.6g} "
            f"but correct_answer is {expected:.6g} (tolerance={tolerance:.3g})"
        )

    return True, f"physics calculation verified: {expr} = {computed:.6g} {unit}".strip()


# ── Tests ─────────────────────────────────────────────────────────────────

def _run_tests() -> None:
    """Inline self-tests. These must ALL pass before batch generation."""

    results: list[Tuple[str, bool]] = []

    def check(label: str, expr: str, expect_ok: bool, qdata: dict = None) -> None:
        if qdata is None:
            # Direct expression test
            try:
                val = safe_eval_physics(expr)
                passed = expect_ok
                print(f"  {'PASS' if passed else 'FAIL'}: {label} → {val}")
            except ValueError as exc:
                passed = not expect_ok
                print(f"  {'PASS' if passed else 'FAIL'}: {label} → ValueError: {exc}")
        else:
            ok, detail = verify(qdata)
            passed = ok == expect_ok
            print(f"  {'PASS' if passed else 'FAIL'}: {label} — {detail}")
        results.append((label, passed))

    print("\n=== Physics Verifier Self-Tests ===\n")

    # ── safe expressions that SHOULD evaluate ────────────────────────────
    check("integer arithmetic", "2 + 3", True)
    check("float arithmetic", "9.81 * 10", True)
    check("constant pi", "pi * 4", True)
    check("constant g", "g * 5", True)
    check("constant e", "e", True)
    check("parentheses", "(100 - 20) * 2", True)
    check("power", "2 ** 10", True)
    check("nested", "g * 2 ** 2 / 2", True)

    # ── malicious expressions that MUST fail ──────────────────────────────
    check("import os attack", "__import__('os').system('ls')", False)
    check("open file attack", "open('/etc/passwd').read()", False)
    check("lambda attack", "1 + (lambda: None)()", False)
    check("builtins attack", "__builtins__['eval']('1+1')", False)
    check("compile attack", "compile('pass','<>','exec')", False)
    check("getattr attack", "getattr(object, '__class__')", False)
    check("unknown name a", "a + b", False)
    check("unknown name sin", "sin(1.0)", False)
    check("exponent too large", "1 ** 1000", False)

    # ── full verify() call tests ──────────────────────────────────────────
    check(
        "valid physics question passes",
        "",
        True,
        {
            "question_type": "science_physics_calculation",
            "correct_answer": "= 98.1 N",
            "verification_expression": "g * 10",
            "verification_unit": "N",
        },
    )

    check(
        "wrong answer fails",
        "",
        False,
        {
            "question_type": "science_physics_calculation",
            "correct_answer": "= 100 N",
            "verification_expression": "g * 10",
            "verification_unit": "N",
        },
    )

    check(
        "unknown unit fails",
        "",
        False,
        {
            "question_type": "science_physics_calculation",
            "correct_answer": "= 9.81",
            "verification_expression": "g",
            "verification_unit": "furlongs_per_fortnight",
        },
    )

    check(
        "wrong question_type rejected",
        "",
        False,
        {
            "question_type": "maths_algebra",
            "correct_answer": "5",
            "verification_expression": "2 + 3",
        },
    )

    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    print(f"\n=== {passed}/{total} tests passed ===\n")


if __name__ == "__main__":
    _run_tests()
