"""
Chemistry verifier for Decifer Learning content pipeline.

Stage 2: code verification — CLAUDE.md §9.

Supported question types:
  science_chemistry_equation  — balanced equation check via ChemPy (if available)
  chemistry_element_fact      — element property lookup via local periodic table
  biology_factual             — RAG-only pass-through (Stage 6 enforces grounding)
  science_factual             — RAG-only pass-through (Stage 6 enforces grounding)

Returns (verified: bool, detail: str). Never raises; failures return False + reason.

ChemPy dependency is optional: if not installed, equation balance checking is skipped
and a warning is logged. The verifier still validates that correct_answer is a valid
equation string in format.
"""

from __future__ import annotations

import logging
import re
from typing import Optional, Tuple

log = logging.getLogger("verifier.chemistry")

VERIFIER_VERSION = "1.0.0"

# ── Periodic table (local, no external calls) ─────────────────────────────

# Minimal statutory element set for KS2/KS3 content.
# symbol → { name, atomic_number, atomic_mass_approx }
_PERIODIC_TABLE: dict[str, dict] = {
    "H":  {"name": "Hydrogen",    "atomic_number": 1,   "atomic_mass": 1.008},
    "He": {"name": "Helium",      "atomic_number": 2,   "atomic_mass": 4.003},
    "Li": {"name": "Lithium",     "atomic_number": 3,   "atomic_mass": 6.941},
    "Be": {"name": "Beryllium",   "atomic_number": 4,   "atomic_mass": 9.012},
    "B":  {"name": "Boron",       "atomic_number": 5,   "atomic_mass": 10.81},
    "C":  {"name": "Carbon",      "atomic_number": 6,   "atomic_mass": 12.011},
    "N":  {"name": "Nitrogen",    "atomic_number": 7,   "atomic_mass": 14.007},
    "O":  {"name": "Oxygen",      "atomic_number": 8,   "atomic_mass": 15.999},
    "F":  {"name": "Fluorine",    "atomic_number": 9,   "atomic_mass": 18.998},
    "Ne": {"name": "Neon",        "atomic_number": 10,  "atomic_mass": 20.18},
    "Na": {"name": "Sodium",      "atomic_number": 11,  "atomic_mass": 22.990},
    "Mg": {"name": "Magnesium",   "atomic_number": 12,  "atomic_mass": 24.305},
    "Al": {"name": "Aluminium",   "atomic_number": 13,  "atomic_mass": 26.982},
    "Si": {"name": "Silicon",     "atomic_number": 14,  "atomic_mass": 28.086},
    "P":  {"name": "Phosphorus",  "atomic_number": 15,  "atomic_mass": 30.974},
    "S":  {"name": "Sulfur",      "atomic_number": 16,  "atomic_mass": 32.06},
    "Cl": {"name": "Chlorine",    "atomic_number": 17,  "atomic_mass": 35.45},
    "Ar": {"name": "Argon",       "atomic_number": 18,  "atomic_mass": 39.948},
    "K":  {"name": "Potassium",   "atomic_number": 19,  "atomic_mass": 39.098},
    "Ca": {"name": "Calcium",     "atomic_number": 20,  "atomic_mass": 40.078},
    "Fe": {"name": "Iron",        "atomic_number": 26,  "atomic_mass": 55.845},
    "Cu": {"name": "Copper",      "atomic_number": 29,  "atomic_mass": 63.546},
    "Zn": {"name": "Zinc",        "atomic_number": 30,  "atomic_mass": 65.38},
    "Ag": {"name": "Silver",      "atomic_number": 47,  "atomic_mass": 107.868},
    "Au": {"name": "Gold",        "atomic_number": 79,  "atomic_mass": 196.967},
    "Pb": {"name": "Lead",        "atomic_number": 82,  "atomic_mass": 207.2},
    "Hg": {"name": "Mercury",     "atomic_number": 80,  "atomic_mass": 200.59},
    "I":  {"name": "Iodine",      "atomic_number": 53,  "atomic_mass": 126.904},
    "Br": {"name": "Bromine",     "atomic_number": 35,  "atomic_mass": 79.904},
    "Ni": {"name": "Nickel",      "atomic_number": 28,  "atomic_mass": 58.693},
    "Mn": {"name": "Manganese",   "atomic_number": 25,  "atomic_mass": 54.938},
    "Cr": {"name": "Chromium",    "atomic_number": 24,  "atomic_mass": 51.996},
    "Ti": {"name": "Titanium",    "atomic_number": 22,  "atomic_mass": 47.867},
    "Pt": {"name": "Platinum",    "atomic_number": 78,  "atomic_mass": 195.084},
    "U":  {"name": "Uranium",     "atomic_number": 92,  "atomic_mass": 238.029},
    "Ra": {"name": "Radium",      "atomic_number": 88,  "atomic_mass": 226.0},
    "Rn": {"name": "Radon",       "atomic_number": 86,  "atomic_mass": 222.0},
    "Kr": {"name": "Krypton",     "atomic_number": 36,  "atomic_mass": 83.798},
    "Xe": {"name": "Xenon",       "atomic_number": 54,  "atomic_mass": 131.293},
    "Ba": {"name": "Barium",      "atomic_number": 56,  "atomic_mass": 137.327},
    "Sr": {"name": "Strontium",   "atomic_number": 38,  "atomic_mass": 87.62},
    "Li": {"name": "Lithium",     "atomic_number": 3,   "atomic_mass": 6.941},
    "Cs": {"name": "Cesium",      "atomic_number": 55,  "atomic_mass": 132.905},
    "Rb": {"name": "Rubidium",    "atomic_number": 37,  "atomic_mass": 85.468},
    "W":  {"name": "Tungsten",    "atomic_number": 74,  "atomic_mass": 183.84},
    "Sn": {"name": "Tin",         "atomic_number": 50,  "atomic_mass": 118.71},
}

# Also map element names to symbols (case-insensitive lookup)
_NAME_TO_SYMBOL: dict[str, str] = {
    v["name"].lower(): k for k, v in _PERIODIC_TABLE.items()
}


def _lookup_element(identifier: str) -> Optional[dict]:
    """Look up an element by symbol (case-sensitive) or name (case-insensitive)."""
    sym = identifier.strip()
    if sym in _PERIODIC_TABLE:
        return {**_PERIODIC_TABLE[sym], "symbol": sym}
    name_lower = sym.lower()
    if name_lower in _NAME_TO_SYMBOL:
        found_sym = _NAME_TO_SYMBOL[name_lower]
        return {**_PERIODIC_TABLE[found_sym], "symbol": found_sym}
    return None


# ── ChemPy equation balance ────────────────────────────────────────────────

def _chempy_available() -> bool:
    try:
        import chempy  # noqa: F401
        return True
    except ImportError:
        return False


def _verify_equation_chempy(equation_str: str) -> Tuple[bool, str]:
    """Use ChemPy to check mass balance of a chemical equation."""
    try:
        from chempy import balance_stoichiometry
        # equation_str expected format: "2H2 + O2 -> 2H2O"
        arrow_variants = ["->", "→", "=", "⇌"]
        separator = None
        for arr in arrow_variants:
            if arr in equation_str:
                separator = arr
                break
        if separator is None:
            return False, f"No reaction arrow found in equation: {equation_str!r}"

        parts = equation_str.split(separator, 1)
        reactants_str = parts[0].strip()
        products_str = parts[1].strip()

        def parse_side(side: str) -> dict:
            species = {}
            for term in re.split(r"\s*\+\s*", side):
                term = term.strip()
                m = re.match(r"^(\d+)?\s*([A-Za-z0-9\(\)]+)$", term)
                if not m:
                    raise ValueError(f"Cannot parse term: {term!r}")
                coeff = int(m.group(1)) if m.group(1) else 1
                formula = m.group(2)
                species[formula] = coeff
            return species

        reac = parse_side(reactants_str)
        prod = parse_side(products_str)

        # Use ChemPy to verify balance
        reac_set, prod_set, *_ = balance_stoichiometry(set(reac), set(prod))

        # Compare with given coefficients
        for formula, coeff in reac.items():
            if reac_set.get(formula) != coeff:
                return False, (
                    f"Coefficient mismatch for {formula!r}: "
                    f"given={coeff}, balanced={reac_set.get(formula)}"
                )
        for formula, coeff in prod.items():
            if prod_set.get(formula) != coeff:
                return False, (
                    f"Coefficient mismatch for {formula!r}: "
                    f"given={coeff}, balanced={prod_set.get(formula)}"
                )
        return True, "equation is balanced"

    except Exception as exc:
        return False, f"ChemPy balance error: {exc}"


def _verify_equation_format(equation_str: str) -> Tuple[bool, str]:
    """Basic format check when ChemPy is not available."""
    if not equation_str:
        return False, "equation string is empty"
    has_arrow = any(arr in equation_str for arr in ["->", "→", "=", "⇌"])
    if not has_arrow:
        return False, f"equation missing reaction arrow: {equation_str!r}"
    return True, "equation format looks valid (ChemPy not available for balance check)"


# ── Element fact verifier ─────────────────────────────────────────────────

def _verify_element_fact(question_data: dict) -> Tuple[bool, str]:
    """Check element property answers against the local periodic table."""
    correct_answer = question_data.get("correct_answer", "").strip()
    question_text = question_data.get("question_text", "")
    metadata = question_data.get("question_metadata") or {}

    element_identifier = metadata.get("element") or ""

    # Try to find element mentioned in question_text or correct_answer
    if not element_identifier:
        # Heuristic: look for capitalised symbol or full name in question
        for sym in sorted(_PERIODIC_TABLE.keys(), key=len, reverse=True):
            if sym in question_text or sym in correct_answer:
                element_identifier = sym
                break
        if not element_identifier:
            for name in sorted(_NAME_TO_SYMBOL.keys(), key=len, reverse=True):
                if name.lower() in question_text.lower():
                    element_identifier = name
                    break

    if not element_identifier:
        return False, "cannot identify element from question_text or question_metadata.element"

    element = _lookup_element(element_identifier)
    if element is None:
        return False, f"element {element_identifier!r} not found in periodic table"

    prop = (metadata.get("property") or "").lower()

    if prop == "atomic_number":
        expected = str(element["atomic_number"])
        if expected not in correct_answer:
            return False, (
                f"atomic number for {element['name']} is {expected}, "
                f"but correct_answer is {correct_answer!r}"
            )
    elif prop == "symbol":
        if element["symbol"] not in correct_answer:
            return False, (
                f"symbol for {element['name']} is {element['symbol']!r}, "
                f"but correct_answer is {correct_answer!r}"
            )
    elif prop == "name":
        if element["name"].lower() not in correct_answer.lower():
            return False, (
                f"name of element {element_identifier!r} is {element['name']!r}, "
                f"but correct_answer is {correct_answer!r}"
            )
    else:
        # No specific property check — just confirm element exists
        pass

    return True, f"element fact verified: {element['name']} (Z={element['atomic_number']})"


# ── Public entry point ────────────────────────────────────────────────────

def verify(question_data: dict) -> Tuple[bool, str]:
    """
    Stage 2 Chemistry/Science verification.

    Dispatches by question_type. Unknown types fail closed.
    biology_factual and science_factual are RAG-only: pass Stage 2 but
    Stage 6 RAG grounding enforces source_chunk_ids.
    """
    qtype = question_data.get("question_type", "")

    if qtype == "science_chemistry_equation":
        eq = question_data.get("correct_answer", "").strip()
        if not eq:
            # Some questions ask students to balance or identify products;
            # try verification_equation field
            eq = question_data.get("verification_equation", "").strip()
        if not eq:
            return False, "correct_answer (equation string) is missing"
        if _chempy_available():
            return _verify_equation_chempy(eq)
        log.warning("ChemPy not available — falling back to format check only")
        return _verify_equation_format(eq)

    if qtype == "chemistry_element_fact":
        return _verify_element_fact(question_data)

    if qtype in ("biology_factual", "science_factual"):
        return True, f"{qtype} passes Stage 2 (RAG grounding enforced in Stage 6)"

    return False, f"Unknown chemistry/science question type: {qtype!r}"


# ── Tests ─────────────────────────────────────────────────────────────────

def _run_tests() -> None:
    results: list[Tuple[str, bool]] = []

    def check(label: str, data: dict, expect_pass: bool) -> None:
        ok, detail = verify(data)
        passed = ok == expect_pass
        results.append((label, passed))
        status = "PASS" if passed else "FAIL"
        print(f"  {status}: {label} — {detail}")

    print("\n=== Chemistry Verifier Self-Tests ===\n")

    # 1. Valid element fact (atomic number)
    check(
        "valid element fact — oxygen atomic number",
        {
            "question_type": "chemistry_element_fact",
            "question_text": "What is the atomic number of Oxygen?",
            "correct_answer": "8",
            "question_metadata": {"element": "O", "property": "atomic_number"},
        },
        expect_pass=True,
    )

    # 2. Invalid element fact (wrong atomic number)
    check(
        "invalid element fact — wrong atomic number for oxygen",
        {
            "question_type": "chemistry_element_fact",
            "question_text": "What is the atomic number of Oxygen?",
            "correct_answer": "10",
            "question_metadata": {"element": "O", "property": "atomic_number"},
        },
        expect_pass=False,
    )

    # 3. Valid balanced equation (format check only without ChemPy)
    check(
        "valid balanced equation format",
        {
            "question_type": "science_chemistry_equation",
            "correct_answer": "2H2 + O2 -> 2H2O",
        },
        expect_pass=True,
    )

    # 4. Invalid equation (no arrow)
    check(
        "invalid equation — no reaction arrow",
        {
            "question_type": "science_chemistry_equation",
            "correct_answer": "2H2 O2 2H2O",
        },
        expect_pass=False,
    )

    # 5. biology_factual passes Stage 2
    check(
        "biology_factual passes Stage 2 (RAG-only)",
        {
            "question_type": "biology_factual",
            "question_text": "What is the role of the lungs?",
            "correct_answer": "The lungs exchange oxygen and carbon dioxide.",
            "source_chunk_ids": ["chunk-1"],
        },
        expect_pass=True,
    )

    # 6. science_factual passes Stage 2
    check(
        "science_factual passes Stage 2 (RAG-only)",
        {
            "question_type": "science_factual",
            "question_text": "What force attracts objects with mass toward each other?",
            "correct_answer": "Gravity",
            "source_chunk_ids": ["chunk-2"],
        },
        expect_pass=True,
    )

    # 7. Unknown type fails closed
    check(
        "unknown question_type fails closed",
        {
            "question_type": "alchemy_transmutation",
            "correct_answer": "gold",
        },
        expect_pass=False,
    )

    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    print(f"\n=== {passed}/{total} tests passed ===\n")


if __name__ == "__main__":
    _run_tests()
