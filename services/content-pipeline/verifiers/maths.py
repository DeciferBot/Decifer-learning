"""
Maths verifier for Decifer Learning content pipeline.

Stage 2: code verification — CLAUDE.md §9.
  maths_arithmetic → safe-eval AST whitelist
  maths_algebra    → SymPy solver
  maths_geometry   → safe-eval (with sympy.pi fallback)

Returns (verified: bool, detail: str). Never raises; failures return False + reason.
"""

import ast
import operator
import re
from typing import Tuple

from sympy import symbols, solve
from sympy.parsing.sympy_parser import parse_expr


# ── Safe arithmetic evaluator ─────────────────────────────────────────────

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


def _eval_node(node: ast.expr) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return float(node.value)
        raise ValueError(f"non-numeric constant: {node.value!r}")
    if isinstance(node, ast.BinOp):
        fn = _SAFE_OPS.get(type(node.op))
        if fn is None:
            raise ValueError(f"unsupported operator: {type(node.op).__name__}")
        left, right = _eval_node(node.left), _eval_node(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 20:
            raise ValueError("exponent too large")
        return fn(left, right)
    if isinstance(node, ast.UnaryOp):
        fn = _SAFE_OPS.get(type(node.op))
        if fn is None:
            raise ValueError(f"unsupported unary op: {type(node.op).__name__}")
        return fn(_eval_node(node.operand))
    raise ValueError(f"unsupported AST node: {type(node).__name__}")


def safe_eval(expression: str) -> float:
    """Evaluate a pure arithmetic expression using a whitelist AST walker."""
    if len(expression) > 200:
        raise ValueError("expression too long")
    try:
        tree = ast.parse(expression.strip(), mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"syntax error: {exc}") from exc
    return _eval_node(tree.body)


# ── Answer parser ─────────────────────────────────────────────────────────

def _parse_numeric(answer: str) -> float:
    """Extract the numeric value from an answer string.

    Handles: '56', 'x = 5', '48 cm²', '3/4', '-3.5'
    """
    s = answer.strip()
    # "x = 5" or "= -3"
    m = re.search(r"=\s*(-?[\d.]+(?:/[\d.]+)?)", s)
    if m:
        s = m.group(1)
    else:
        m2 = re.match(r"^(-?[\d.]+(?:/[\d.]+)?)", s)
        if m2:
            s = m2.group(1)
    if not s:
        raise ValueError(f"cannot parse numeric value from {answer!r}")
    if "/" in s:
        num, den = s.split("/", 1)
        return float(num) / float(den)
    return float(s)


# ── Per-type verifiers ────────────────────────────────────────────────────

def verify_arithmetic(verification_expression: str, correct_answer: str) -> Tuple[bool, str]:
    """Stage 2: safe-eval for maths_arithmetic."""
    try:
        computed = safe_eval(verification_expression)
    except ValueError as exc:
        return False, f"safe_eval: {exc}"
    try:
        expected = _parse_numeric(correct_answer)
    except ValueError as exc:
        return False, f"answer parse: {exc}"
    tol = max(1e-6, abs(expected) * 1e-6)
    if abs(computed - expected) <= tol:
        return True, str(computed)
    return False, f"computed {computed} ≠ claimed {expected}"


def verify_algebra(
    verification_equation: str, variable: str, correct_answer: str
) -> Tuple[bool, str]:
    """Stage 2: SymPy solver for maths_algebra.

    verification_equation is a SymPy expression equal to 0 at the solution,
    e.g. '2*x + 3 - 11' for the equation 2x + 3 = 11.
    """
    try:
        var = symbols(variable)
        expr = parse_expr(verification_equation, local_dict={variable: var})
        solutions = solve(expr, var)
    except Exception as exc:
        return False, f"SymPy: {exc}"
    if not solutions:
        return False, "SymPy found no solutions"
    try:
        expected = _parse_numeric(correct_answer)
    except ValueError as exc:
        return False, f"answer parse: {exc}"
    for sol in solutions:
        try:
            if abs(float(sol) - expected) < 1e-6:
                return True, str(float(sol))
        except (TypeError, ValueError):
            pass
    return False, f"SymPy solutions {solutions} do not match {expected}"


def verify_geometry(verification_expression: str, correct_answer: str) -> Tuple[bool, str]:
    """Stage 2: safe-eval (with sympy.pi fallback) for maths_geometry."""
    try:
        computed = safe_eval(verification_expression)
    except ValueError:
        try:
            from sympy import pi, sqrt, sympify
            computed = float(sympify(verification_expression))
        except Exception as exc:
            return False, f"geometry eval: {exc}"
    try:
        expected = _parse_numeric(correct_answer)
    except ValueError as exc:
        return False, f"answer parse: {exc}"
    tol = max(1e-4, abs(expected) * 1e-4)
    if abs(computed - expected) <= tol:
        return True, str(round(computed, 6))
    return False, f"computed {round(computed, 6)} ≠ claimed {expected}"


# ── Dispatcher ────────────────────────────────────────────────────────────

def verify(question_data: dict) -> Tuple[bool, str]:
    """Dispatch to the correct verifier based on question_type.

    Returns (verified, detail). Never raises.
    """
    qtype = question_data.get("question_type", "")

    if qtype == "maths_arithmetic":
        expr = question_data.get("verification_expression", "")
        if not expr:
            return False, "missing verification_expression"
        return verify_arithmetic(expr, question_data.get("correct_answer", ""))

    if qtype == "maths_algebra":
        eq  = question_data.get("verification_equation", "")
        var = question_data.get("verification_variable", "x")
        if not eq:
            return False, "missing verification_equation"
        return verify_algebra(eq, var, question_data.get("correct_answer", ""))

    if qtype == "maths_geometry":
        expr = question_data.get("verification_expression", "")
        if not expr:
            return False, "missing verification_expression"
        return verify_geometry(expr, question_data.get("correct_answer", ""))

    return False, f"unsupported question_type: {qtype!r}"
