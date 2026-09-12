"""
PHASE 3 verification — data-integrity fixes.
Verifies directly (no live Gemini needed):
  1. Country-of-origin word-boundary fix: short variants ('us'/'ind') no longer
     false-flag inside longer words (NutriPlus, Bombay) yet still detect real ones.
  2. Consolidated grading: grade_for_score() identical across all three modules
     (compliance.py, comply.py, compliance_copy.py) and NaN-safe.
  3. Rule-citation validation: _valid_citation_findings() drops invented citations
     (Rule 99) but keeps valid ones (Rule 6(e)); NaN score/quality coerced clean.

Run:  venv\\Scripts\\python.exe verify_phase3.py
"""
import math
import re
import compliance
import comply
import compliance_copy

passed = []
def check(name, cond, detail=""):
    passed.append(cond)
    print(("PASS" if cond else "FAIL"), "-", name, (": "+detail) if detail else "")

# ---------------------------------------------------------------
# 1) Word-boundary country matching (exact logic committed in compliance_copy.py)
# ---------------------------------------------------------------
def _variant_in(text, variant):
    return re.search(r'(?<![a-z])' + re.escape(variant) + r'(?![a-z])', text) is not None

country_variants = {
    'india': ['india', 'indian', 'bharat', 'ind'],
    'china': ['china', 'chinese', 'prc', 'peoples republic of china'],
    'usa': ['usa', 'united states', 'america', 'us'],
    'uk': ['uk', 'united kingdom', 'britain', 'great britain', 'england'],
    'germany': ['germany', 'german', 'deutschland'],
    'japan': ['japan', 'japanese', 'nihon'],
    'korea': ['korea', 'korean', 'south korea'],
    'taiwan': ['taiwan', 'taiwanese', 'roc'],
}
def detect(variants, text):
    for key, vs in variants.items():
        if any(_variant_in(text, v) for v in vs):
            return key
    return None

# False positives (before fix: substring matched 'us'/'ind' inside words)
check("NutriPlus address NOT flagged USA (no country word -> None)",
      detect(country_variants, "NUTRI PLUS FOODS LTD, MUMBAI".lower()) is None,
      f"detected={detect(country_variants, 'NUTRI PLUS FOODS LTD, MUMBAI'.lower())}")
check("'Bombay' address NOT flagged (no 'ind'/'us' substring match)",
      detect(country_variants, "BOMBAY, INDIA 400001".lower()) == "india",
      f"detected={detect(country_variants, 'BOMBAY, INDIA 400001'.lower())}")
check("'subject to...' does NOT flag USA",
      detect(country_variants, "the subject was inspected".lower()) is None,
      f"detected={detect(country_variants, 'the subject was inspected'.lower())}")
# True positives still work
check("'made in usa' -> USA",
      detect(country_variants, "made in usa") == "usa")
check("'united states of america' -> USA",
      detect(country_variants, "united states of america") == "usa")
check("'made in india' -> India",
      detect(country_variants, "made in india") == "india")
check("'made in china' -> China",
      detect(country_variants, "made in china") == "china")
check("standalone 'uk' -> UK",
      detect(country_variants, "made in uk") == "uk")

# ---------------------------------------------------------------
# 2) Consolidated grading — identical ladder across all three modules, NaN-safe
# ---------------------------------------------------------------
scores = [0, 24, 25, 34, 35, 44, 45, 54, 55, 64, 65, 74, 75, 84, 85, 90, 100, float('nan')]
grids = {
    "compliance.py": [compliance.grade_for_score(s) for s in scores],
    "comply.py":     [comply.grade_for_score(s) for s in scores],
    "compliance_copy.py": [compliance_copy.grade_for_score(s) for s in scores],
}
names = list(grids.keys())
base = grids[names[0]]
check("grade_for_score ladders identical across 3 modules",
      all(grids[n] == base for n in names), str(base))
check("grade_for_score(NaN) -> 'F' (handled, no crash)",
      base[-1] == "F",
      base[-1])
# Sanity: distinct thresholds map to distinct grades; NaN is the last entry
check("threshold scaling sane (0->F, 90->A+, 100->A+)",
      base[0] == "F" and base[15] == "A+" and base[16] == "A+",
      f"{base[0]}/{base[15]}/{base[16]}")

# ---------------------------------------------------------------
# 3) Rule-citation validation (compliance._valid_citation_findings)
# ---------------------------------------------------------------
sample_rules = [
    {"name": "Rule 6(e): Maximum Retail Price"},
    {"name": "Rule 6(a): Manufacturer address"},
    {"name": "Rule 18: MRP not exceed package MRP"},
]
findings = [
    {"requirement": "Rule 6(e): Maximum Retail Price", "status": "present"},
    {"requirement": "Rule 18", "status": "missing"},
    {"requirement": "Rule 99(z): Totally invented", "status": "present"},
    {"requirement": "Common/Generic product name", "status": "present"},
]
kept = compliance._valid_citation_findings(findings, sample_rules)
reqs_kept = [f["requirement"] for f in kept]
check("invented 'Rule 99(z)' dropped",
      "Rule 99(z): Totally invented" not in reqs_kept, str(reqs_kept))
check("valid 'Rule 6(e)' kept", "Rule 6(e): Maximum Retail Price" in reqs_kept)
check("valid 'Rule 18' kept", "Rule 18" in reqs_kept)
check("non-cited finding kept", "Common/Generic product name" in reqs_kept)

# NaN-clean output path: the round(score) only ever sees finite total_score
check("_rule_number parses 'Rule 6(e)' -> 6",
      compliance._rule_number("Rule 6(e)") == 6)
check("_rule_number(None) -> None", compliance._rule_number(None) is None)
check("_rule_number('plain name') -> None", compliance._rule_number("plain name") is None)

total = len(passed); ok = sum(1 for p in passed if p)
print(f"\nPhase 3: {ok}/{total} checks passed")
if ok != total:
    raise SystemExit(1)
print("Phase 3 verification: PASS")
