#!/usr/bin/env python3
"""
PHASE 12 verification — fake-F fix (Gemini quota exhaustion).

Reproduces the exact live failure seen for Maggi 2-Minute Masala Noodles
(ASIN B01N1UL0MZ, product_id 19) in server_run.log: the Gemini free-tier
quota (20 req/day) hit 429 RESOURCE_EXHAUSTED, BOTH analysis layers
returned ZERO findings, and the scorer penalized every Legal Metrology
rule (90% + 10% = 100%) -> score 0.0, grade 'F' — persisted to the DB and
shown in the UI for a fully compliant product.

This suite verifies the fix, offline (no Gemini, no DB):
  1. offline_analysis extracts real declarations from the actual scraped
     Maggi listing (MRP, net quantity, unit price, dimensions, common name,
     manufacturer partial; origin/contact/dates honestly missing).
  2. compliance_copy.calculate_compliance_score with the offline findings
     now produces a REAL grade (no longer 0.0/F) for the Maggi data.
  3. is_analysis_indeterminate: TRUE for the old crash shape (both layers
     failed, zero findings) and the scorer returns score=None / grade='N/A'
     instead of a fake 0/F.
  4. Genuine no-declaration products (audit case #4: AI analyzed
     everything, nothing declared, no layer failed) still score 0/F.
  5. ai_guard / get_llm NameError fixed: compliance_copy.get_llm exists
     and ai_guard is importable & callable inside the module namespace.
  6. grade_for_score ladders still identical across the three modules
     (regression guard from Phase 3).
  7. Retry helper fails fast on quota 429 (single attempt, RateLimitError)
     — matches comply.py's Phase 10 design; compliance_copy now matches.

Run:  .\\venv\\Scripts\\python.exe verify_phase12.py
"""
import os
import sys

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import offline_analysis as oa
import compliance_copy

passed = []


def check(name, cond, detail=""):
    passed.append(cond)
    print(("PASS" if cond else "FAIL"), "-", name, (": " + str(detail)) if detail else "")


# ---------------------------------------------------------------------------
# The ACTUAL scraped listing data for ASIN B01N1UL0MZ (from server_run.log,
# product_json_raw) — trimmed to the compliance-relevant fields.
# ---------------------------------------------------------------------------
MAGGI_DATA = {
    "title": "Nestle Maggi 2-MINN Masala Nong 70 Grams",
    "price": 198.0,
    "currency": "INR",
    "country": "IN",  # marketplace country — must NOT count as origin
    "price_per_unit": {"unit": "100 g", "value": 282.86, "currency": "INR"},
    "specifications": {
        "ASIN": "B01N1UL0MZ",
        "Brand": "MAGGI",
        "Weight": "840 Grams",
        "Specialty": "Suitable for Vegetarians",
        "Ingredients": "redefined wheat flour (maida), palm oil, salt, wheat gluten",
        "Manufacturer": "Nestle",
        "Net Quantity": "70.0 Grams",
        "Item part number": "12315172",
        "Package Dimensions": "22.86 x 12.7 x 5.33 cm; 840 g",
        "Date First Available": "21 December 2016",
    },
    "feature_bullets": [
        {"value": "100% Vegetarian MAGGI noodles"},
        {"value": "Store in a cool, dry and hygienic place"},
    ],
    "description": "Nestle MAGGI 2-Minute Masala Noodles, No Onion and No Garlic variant.",
}

# The universal Legal Metrology rules used by compliance_copy's scorer.
CC_RULES = (
    compliance_copy.LEGAL_METROLOGY_RULES["high_priority"]
    + compliance_copy.LEGAL_METROLOGY_RULES["low_priority"]
    + [compliance_copy.LEGAL_METROLOGY_RULES["common_name"]]
)

# ---------------------------------------------------------------------------
# 1) Offline extractor finds the real declarations in the Maggi listing
# ---------------------------------------------------------------------------
offline_res = oa.offline_data_findings(MAGGI_DATA, "amazon", CC_RULES)
by_req = {f["requirement"]: f for f in offline_res["findings"]}

check("offline: emits a finding for every mappable rule",
      len(offline_res["findings"]) >= 7, len(offline_res["findings"]))
check("offline: MRP found present (198.0 INR)",
      by_req.get("MRP (Maximum Retail Price)", {}).get("status") == "present",
      by_req.get("MRP (Maximum Retail Price)", {}).get("extracted_value"))
check("offline: Net Quantity found present (70.0 Grams)",
      by_req.get("Net Quantity", {}).get("status") == "present",
      by_req.get("Net Quantity", {}).get("extracted_value"))
check("offline: Unit Price found present (282.86 INR per 100 g)",
      by_req.get("Unit Price", {}).get("status") == "present",
      by_req.get("Unit Price", {}).get("extracted_value"))
check("offline: Dimensions found present",
      by_req.get("Product Dimensions/Size", {}).get("status") == "present")
check("offline: Common name found present",
      by_req.get("Common/Generic Name", {}).get("status") == "present")
check("offline: Manufacturer found (partial, name-only)",
      by_req.get("Manufacturer/Packer/Importer Name and Address", {}).get("status") == "partial",
      by_req.get("Manufacturer/Packer/Importer Name and Address", {}).get("extracted_value"))
check("offline: marketplace 'country' NOT misread as origin",
      by_req.get("Country of Origin", {}).get("status") == "missing")
check("offline: result carries offline markers",
      offline_res.get("offline") is True and offline_res.get("analysis_mode") == "offline")


# ---------------------------------------------------------------------------
# 2) Scorer with the offline findings produces a REAL grade for Maggi
# ---------------------------------------------------------------------------
scoring = compliance_copy.calculate_compliance_score(
    {"visual_findings": [], "error": "Gemini rate limit reached", "ocr_success": False},
    offline_res,
    "amazon",
)
check("scorer: Maggi offline score is real (not 0.0/F)",
      scoring.get("score") is not None and scoring["score"] > 0 and scoring["grade"] != "F",
      f"score={scoring.get('score')} grade={scoring.get('grade')}")
check("scorer: surfaces analysis_mode=offline",
      scoring.get("analysis_mode") == "offline", scoring.get("analysis_mode"))

# ---------------------------------------------------------------------------
# 3) The old crash shape (both layers failed, zero findings) -> N/A
# ---------------------------------------------------------------------------
failed_ocr = {"visual_findings": [], "ocr_success": False,
              "error": "429 RESOURCE_EXHAUSTED quota exceeded"}
failed_data = {"findings": [], "error": "Error calling model (RESOURCE_EXHAUSTED): 429"}
check("indeterminate: detected for both-failed/zero-findings shape",
      oa.is_analysis_indeterminate(failed_ocr, failed_data) is True)
scoring_na = compliance_copy.calculate_compliance_score(failed_ocr, failed_data, "amazon")
check("scorer: both-failed/zero-findings -> score None + grade N/A",
      scoring_na.get("score") is None and scoring_na.get("grade") == "N/A"
      and scoring_na.get("analysis_status") == "indeterminate",
      f"{scoring_na.get('score')}/{scoring_na.get('grade')}")
check("indeterminate: NOT flagged when a source produced findings",
      oa.is_analysis_indeterminate(failed_ocr, offline_res) is False)

# ---------------------------------------------------------------------------
# 4) Genuine no-declaration product still scores 0/F (no layer failed)
# ---------------------------------------------------------------------------
analyzed_nothing = {
    "visual_findings": [
        {"requirement": "MRP (Maximum Retail Price)", "status": "missing", "extracted_value": ""}
    ],
    "ocr_success": True,
}
check("indeterminate: NOT flagged when analysis succeeded but nothing declared",
      oa.is_analysis_indeterminate(analyzed_nothing, {"findings": []}) is False)
scoring_legit_f = compliance_copy.calculate_compliance_score(
    analyzed_nothing, {"findings": []}, "amazon")
check("scorer: genuine no-declaration product still 0/F",
      scoring_legit_f.get("score") == 0 and scoring_legit_f.get("grade") == "F",
      f"{scoring_legit_f.get('score')}/{scoring_legit_f.get('grade')}")

# ---------------------------------------------------------------------------
# 5) NameError fixes (ai_guard importable + get_llm exists in both modules)
# ---------------------------------------------------------------------------
import compliance
check("compliance_copy.get_llm exists (no NameError)",
      callable(getattr(compliance_copy, "get_llm", None)))
check("compliance.get_llm exists (no NameError)",
      callable(getattr(compliance, "get_llm", None)))
check("compliance_copy.ai_guard imported (no NameError)",
      getattr(compliance_copy, "ai_guard", None) is not None)
try:
    compliance_copy.get_llm()
    check("compliance_copy.get_llm() callable without crash", True)
except NameError as e:
    check("compliance_copy.get_llm() callable without crash", False, str(e))

# ---------------------------------------------------------------------------
# 6) grade ladder regression (Phase 3)
# ---------------------------------------------------------------------------
scores = [0, 24, 25, 34, 35, 44, 45, 54, 55, 64, 65, 74, 75, 84, 85, 90, 100]
import comply
grids = {
    "compliance.py": [compliance.grade_for_score(s) for s in scores],
    "compliance_copy.py": [compliance_copy.grade_for_score(s) for s in scores],
    "comply.py": [comply.grade_for_score(s) for s in scores],
}
names = list(grids.keys())
base = grids[names[0]]
check("grade_for_score ladders identical across 3 modules",
      all(grids[n] == base for n in names), base)

# ---------------------------------------------------------------------------
# 7) compliance_copy retry now fails fast on quota 429 (Phase 10 parity)
# ---------------------------------------------------------------------------
class FakeModel:
    def __init__(self):
        self.calls = 0

    def generate_content(self, *a, **k):
        self.calls += 1
        raise Exception("429 RESOURCE_EXHAUSTED quota exceeded")

import ai_guard
ai_guard.clear()
m = FakeModel()
try:
    compliance_copy.generate_with_retry(m, "x", max_attempts=3, base_delay=0.001)
    check("compliance_copy.generate_with_retry raises RateLimitError on 429", False)
except compliance_copy.RateLimitError:
    check("compliance_copy.generate_with_retry raises RateLimitError on 429",
          True, f"attempts={m.calls}")
check("compliance_copy.generate_with_retry fails fast on quota 429 (no backoff)",
      m.calls == 1, f"calls={m.calls}")

class OkModel:
    def generate_content(self, *a, **k):
        return "ok"

check("compliance_copy.generate_with_retry returns success when no error",
      compliance_copy.generate_with_retry(OkModel(), "x") == "ok")

ai_guard.clear()

# ---------------------------------------------------------------------------
total = len(passed)
ok = sum(1 for p in passed if p)
print(f"\nPhase 12: {ok}/{total} checks passed")
if ok != total:
    raise SystemExit(1)
print("Phase 12 verification: PASS")
