#!/usr/bin/env python3.11
"""
Seed curriculum_chunks with KS2 Year 3 and KS3 Year 7 Maths content.

Calls the pipeline /ingest endpoint. Run the pipeline service first:
  cd services/content-pipeline && uvicorn main:app --port 8000

Usage:
  python3.11 scripts/seed-knowledge-base.py [--url http://localhost:8000]

Content is sourced from the UK National Curriculum for Mathematics.
CLAUDE.md §9 Stage 3: only Maths is seeded for Phase 3.
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

CHUNKS: list[dict] = [
    # ── Year 3 (KS2) Maths ──────────────────────────────────────────────
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Number and Place Value",
        "chunk_text": (
            "In Year 3, pupils learn to count from 0 in multiples of 4, 8, 50 and 100. "
            "They find 10 or 100 more or less than a given number. "
            "They recognise the place value of each digit in a three-digit number "
            "(hundreds, tens, ones). For example, in 347: 3 hundreds = 300, 4 tens = 40, 7 ones = 7. "
            "Pupils compare and order numbers up to 1000 using the symbols <, > and =. "
            "They identify, represent and estimate numbers using different representations, "
            "including the number line."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Addition and Subtraction",
        "chunk_text": (
            "Year 3 pupils add and subtract numbers mentally, including a three-digit number "
            "and ones, a three-digit number and tens, and a three-digit number and hundreds. "
            "They add and subtract numbers with up to three digits using formal written "
            "methods of columnar addition and subtraction. "
            "Pupils estimate the answer to a calculation and use inverse operations to check. "
            "Example: 245 + 138 = 383; 500 − 267 = 233. "
            "Number bonds to 100: e.g. 37 + 63 = 100."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Multiplication and Division",
        "chunk_text": (
            "Year 3 pupils recall and use multiplication and division facts for the 3, 4 and 8 "
            "multiplication tables. They build on their knowledge of the 2, 5 and 10 times tables. "
            "3 times table: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36. "
            "4 times table: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48. "
            "8 times table: 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96. "
            "Pupils write and calculate mathematical statements for multiplication and division "
            "using the multiplication tables they know. "
            "Example: 4 × 8 = 32, so 32 ÷ 4 = 8 and 32 ÷ 8 = 4."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Multiplication Word Problems",
        "chunk_text": (
            "Pupils solve problems, including missing number problems, involving multiplication "
            "and division, including positive integer scaling problems and correspondence "
            "problems in which n objects are connected to m objects. "
            "Example: There are 6 bags each containing 8 apples. How many apples are there? "
            "6 × 8 = 48. "
            "Example: 35 pupils sit in 5 equal rows. How many are in each row? 35 ÷ 5 = 7. "
            "Doubling and halving: double 24 = 48; half of 36 = 18."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Fractions",
        "chunk_text": (
            "Year 3 pupils count up and down in tenths. They recognise, find and write fractions "
            "of a discrete set of objects: unit fractions and non-unit fractions with small "
            "denominators. Pupils recognise and use fractions as numbers: unit fractions and "
            "non-unit fractions with small denominators. "
            "A unit fraction has 1 as its numerator: 1/2, 1/3, 1/4, 1/5, 1/8, 1/10. "
            "Non-unit fractions: 2/3, 3/4, 5/8. "
            "Pupils compare and order unit fractions, and fractions with the same denominators. "
            "Equivalent fractions: 1/2 = 2/4 = 3/6 = 4/8."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Fractions of Quantities",
        "chunk_text": (
            "Finding fractions of amounts: to find 1/3 of 24, divide by 3: 24 ÷ 3 = 8. "
            "To find 2/3 of 24: find 1/3 first (= 8), then multiply by 2: 8 × 2 = 16. "
            "To find 3/4 of 28: 28 ÷ 4 = 7 (one quarter), then 7 × 3 = 21. "
            "To find 1/8 of 64: 64 ÷ 8 = 8. "
            "Adding fractions with the same denominator: 1/5 + 2/5 = 3/5. "
            "Subtracting fractions: 4/7 − 1/7 = 3/7."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Measurement: Length and Perimeter",
        "chunk_text": (
            "Year 3 pupils measure, compare, add and subtract: lengths (m/cm/mm). "
            "1 metre (m) = 100 centimetres (cm). 1 centimetre = 10 millimetres (mm). "
            "1 kilometre (km) = 1000 metres. "
            "Pupils measure the perimeter of simple 2D shapes. "
            "Perimeter of a rectangle = length + width + length + width = 2 × (length + width). "
            "Example: A rectangle is 8 cm long and 5 cm wide. Perimeter = 2 × (8 + 5) = 26 cm. "
            "Perimeter of a square = 4 × side length. Example: Square with side 6 cm: perimeter = 24 cm."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Measurement: Mass and Capacity",
        "chunk_text": (
            "Pupils measure, compare, add and subtract: mass (kg/g); volume/capacity (l/ml). "
            "1 kilogram (kg) = 1000 grams (g). "
            "1 litre (l) = 1000 millilitres (ml). "
            "Example: A bag weighs 2 kg 350 g = 2350 g. "
            "Example: A bottle holds 750 ml. How many ml in 3 bottles? 750 × 3 = 2250 ml. "
            "Adding masses: 450 g + 780 g = 1230 g = 1 kg 230 g."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Measurement: Time",
        "chunk_text": (
            "Year 3 pupils tell and write the time from an analogue clock, including Roman numerals "
            "from I to XII. They estimate and read time to the nearest minute, record and compare "
            "time in terms of seconds, minutes and hours. "
            "60 seconds = 1 minute. 60 minutes = 1 hour. 24 hours = 1 day. "
            "12-hour clock: am (midnight to noon), pm (noon to midnight). "
            "Duration: from 10:25 am to 11:10 am = 45 minutes. "
            "Pupils know the number of seconds in a minute and the number of days in each month."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Geometry: Shapes",
        "chunk_text": (
            "Year 3 pupils draw 2D shapes and make 3D shapes using modelling materials. "
            "They recognise 3D shapes in different orientations. "
            "2D shapes: triangle (3 sides), quadrilateral (4 sides), pentagon (5 sides), "
            "hexagon (6 sides), octagon (8 sides). "
            "A square is a special rectangle where all 4 sides are equal. "
            "A right angle is a 90° angle (a quarter turn). "
            "Pupils identify horizontal and vertical lines and pairs of perpendicular and "
            "parallel lines. "
            "3D shapes: cube (6 square faces), cuboid, sphere, cylinder, cone, triangular prism."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Statistics",
        "chunk_text": (
            "Year 3 pupils interpret and present data using bar charts, pictograms and tables. "
            "They solve one-step and two-step questions such as 'How many more?' and "
            "'How many fewer?' using information from scaled bar charts and pictograms. "
            "Example: A pictogram shows each symbol = 4 children. If 3 symbols are shown "
            "for swimming, 3 × 4 = 12 children chose swimming. "
            "Reading tables: add rows or columns to answer questions."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-3",
        "source_name": "UK NC KS2 Maths — Mental Arithmetic Strategies",
        "chunk_text": (
            "Useful mental strategies for Year 3: "
            "Partitioning: 46 + 37 = 40 + 30 + 6 + 7 = 70 + 13 = 83. "
            "Near doubles: 6 + 7 = double 6 + 1 = 13. "
            "Bridging through 10: 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13. "
            "Rounding to nearest 10: 48 rounds to 50; 73 rounds to 70. "
            "Compensation: 99 + 36 = 100 + 36 − 1 = 135. "
            "Inverse operations: if 7 × 9 = 63, then 63 ÷ 9 = 7."
        ),
    },
    # ── Year 7 (KS3) Maths ──────────────────────────────────────────────
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Number: Integers and BIDMAS",
        "chunk_text": (
            "Year 7 pupils work with positive and negative integers. "
            "Adding a negative number: 5 + (−3) = 2. Subtracting a negative: 5 − (−3) = 8. "
            "Multiplying/dividing: positive × positive = positive; negative × negative = positive; "
            "positive × negative = negative. "
            "BIDMAS order of operations: Brackets, Indices, Division, Multiplication, "
            "Addition, Subtraction. "
            "Example: 3 + 4 × 2 = 3 + 8 = 11 (not 14). "
            "Example: (3 + 4) × 2 = 7 × 2 = 14."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Number: Factors, Multiples, Primes",
        "chunk_text": (
            "A factor of a number divides it exactly. Factors of 24: 1, 2, 3, 4, 6, 8, 12, 24. "
            "A multiple is the result of multiplying a number by an integer. Multiples of 7: 7, 14, 21, 28, … "
            "A prime number has exactly two factors: 1 and itself. "
            "Primes: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, … "
            "1 is NOT a prime. 2 is the only even prime. "
            "Highest Common Factor (HCF) of 12 and 18: factors of 12 = {1,2,3,4,6,12}, "
            "factors of 18 = {1,2,3,6,9,18}. HCF = 6. "
            "Lowest Common Multiple (LCM) of 4 and 6: multiples of 4 = 4,8,12,16…; "
            "multiples of 6 = 6,12,18… LCM = 12."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Fractions, Decimals and Percentages",
        "chunk_text": (
            "Equivalence: 1/2 = 0.5 = 50%; 1/4 = 0.25 = 25%; 3/4 = 0.75 = 75%; "
            "1/5 = 0.2 = 20%; 1/10 = 0.1 = 10%; 1/3 ≈ 0.333 ≈ 33.3%. "
            "To convert a fraction to a percentage: divide numerator by denominator, multiply by 100. "
            "Example: 3/8 = 0.375 = 37.5%. "
            "To find a percentage of an amount: 15% of 80 = 0.15 × 80 = 12. "
            "To find percentage increase/decrease: (change ÷ original) × 100. "
            "Example: price rises from £40 to £50: increase = £10, % increase = (10/40) × 100 = 25%."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Algebra: Expressions and Simplifying",
        "chunk_text": (
            "Algebraic notation: a letter represents an unknown or variable. "
            "3x means 3 × x. xy means x × y. x² means x × x. "
            "Collecting like terms: 5x + 3x = 8x; 7y − 2y = 5y; 4x + 3y − x + 2y = 3x + 5y. "
            "Expanding brackets: 3(x + 4) = 3x + 12; 2(3x − 5) = 6x − 10. "
            "Factorising: 6x + 9 = 3(2x + 3). "
            "Substitution: if x = 4, then 3x + 7 = 3(4) + 7 = 12 + 7 = 19."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Algebra: Linear Equations",
        "chunk_text": (
            "Solving linear equations: perform the same operation on both sides. "
            "Example: 2x + 5 = 13 → subtract 5: 2x = 8 → divide by 2: x = 4. "
            "Example: 3x − 7 = 11 → add 7: 3x = 18 → divide by 3: x = 6. "
            "Example with brackets: 2(x + 3) = 14 → expand: 2x + 6 = 14 → 2x = 8 → x = 4. "
            "Example: x/5 = 7 → multiply by 5: x = 35. "
            "Example: (x + 3)/2 = 5 → multiply by 2: x + 3 = 10 → x = 7. "
            "Always check: substitute back into the original equation."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Algebra: Sequences",
        "chunk_text": (
            "An arithmetic (linear) sequence increases or decreases by a constant difference. "
            "Example: 3, 7, 11, 15, 19, … has common difference +4. "
            "The nth term formula: nth term = first term + (n−1) × common difference. "
            "For 3, 7, 11, 15, …: nth term = 3 + (n−1) × 4 = 4n − 1. "
            "To find the 10th term: 4(10) − 1 = 39. "
            "A geometric sequence multiplies by a constant ratio. "
            "Example: 2, 6, 18, 54, … ratio = 3. "
            "Term-to-term rule: each term = previous term + common difference (for arithmetic)."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Geometry: Area and Perimeter",
        "chunk_text": (
            "Area of a rectangle = length × width. "
            "Area of a triangle = ½ × base × height. "
            "Area of a parallelogram = base × perpendicular height. "
            "Area of a trapezium = ½ × (a + b) × h, where a and b are parallel sides. "
            "Area of a circle = π × r² (π ≈ 3.14159, r = radius). "
            "Circumference of a circle = 2 × π × r = π × diameter. "
            "Example: Circle with radius 5 cm: area = π × 25 ≈ 78.54 cm². "
            "Perimeter of a rectangle = 2 × (length + width). "
            "Example: Rectangle 9 cm × 4 cm: area = 36 cm², perimeter = 26 cm."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Geometry: Angles",
        "chunk_text": (
            "Angles on a straight line add up to 180°. "
            "Angles around a point add up to 360°. "
            "Vertically opposite angles are equal. "
            "Angles in a triangle add up to 180°. "
            "Angles in a quadrilateral add up to 360°. "
            "An equilateral triangle has three equal angles of 60°. "
            "An isosceles triangle has two equal angles. "
            "Interior angle of a regular n-sided polygon = (n−2) × 180° ÷ n. "
            "Example: interior angle of a regular hexagon = (6−2) × 180° ÷ 6 = 120°."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Statistics: Averages and Range",
        "chunk_text": (
            "Mean = sum of all values ÷ number of values. "
            "Example: data set 4, 7, 9, 5, 10. Sum = 35, mean = 35 ÷ 5 = 7. "
            "Median = middle value when data is ordered. "
            "For 4, 5, 7, 9, 10 (5 values): median = 7 (middle value). "
            "For an even number of values, median = mean of the two middle values. "
            "Mode = most frequent value. If no value repeats, there is no mode. "
            "Range = largest value − smallest value. "
            "For 4, 5, 7, 9, 10: range = 10 − 4 = 6."
        ),
    },
    {
        "subject": "Maths",
        "year_group": "year-7",
        "source_name": "UK NC KS3 Maths — Ratio and Proportion",
        "chunk_text": (
            "A ratio compares two quantities. Written as a:b. "
            "Example: a recipe uses 3 cups of flour to 2 cups of sugar. Ratio = 3:2. "
            "Simplifying ratios: 12:8 → divide both by HCF (4) → 3:2. "
            "Dividing in a given ratio: share £40 in ratio 3:5. "
            "Total parts = 3 + 5 = 8. Each part = £40 ÷ 8 = £5. "
            "Share: 3 × £5 = £15 and 5 × £5 = £25. "
            "Proportion: if 5 items cost £7.50, one item costs £1.50; 8 items cost 8 × £1.50 = £12."
        ),
    },
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000")
    args = parser.parse_args()

    url = f"{args.url.rstrip('/')}/ingest"
    payload = json.dumps({"chunks": CHUNKS}).encode()

    print(f"Seeding {len(CHUNKS)} curriculum chunks → {url}")
    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
        print(f"✅ inserted={result['inserted']}  skipped={result['skipped']}")
    except urllib.error.URLError as exc:
        print(f"❌ Could not reach {url}: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
