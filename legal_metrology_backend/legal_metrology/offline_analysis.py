#!/usr/bin/env python3
"""
Deterministic OFFLINE fallback for product-data compliance analysis.

Problem (verified live, see FIXES.md "Phase 12"): when the Gemini free-tier
quota was exhausted (429 RESOURCE_EXHAUSTED), BOTH analysis layers returned
zero findings, and every compliance scorer then treated "AI produced no
findings" as "all Legal Metrology declarations are missing" — a fully
compliant product (e.g. Maggi 2-Minute Masala Noodles, ASIN B01N1UL0MZ) was
penalized 100% and graded F 0.0/100. That fake F was persisted and shown
in the UI as a real verdict.

This module provides:
  - `offline_data_findings(product_data, category, rules)` — a pure-stdlib,
    deterministic keyword/regex extraction over the flattened listing JSON
    that emits findings in the EXACT shape of the Gemini data-analysis prompt
    (requirement/status/found_in/extracted_value/adequacy/notes), one finding
    per rule it can map to a concept. Requirement names are taken verbatim
    from the caller's rule list, so every scorer (compliance.py,
    compliance_copy.py, comply.py — each with slightly different rule names)
    matches them without fuzzy-lookup fragility.
  - `is_analysis_indeterminate(ocr_results, data_analysis)` — True only when
    NO findings came from ANY source AND at least one analysis layer actually
    FAILED (error / rate-limit / offline marker). This is the "cannot grade"
    signal the scorers use to return score None + grade 'N/A' instead of a
    fake 0/F. A product whose images and listing were genuinely analyzed and
    genuinely declare nothing (audit case #4: irrelevant image) still scores
    0/F legitimately, because in that case no layer failed.

Stdlib-only. Never imported at module load time by anything that must not
fail (no DB, no network, no Gemini).
"""
import re
from typing import Any, Dict, List, Optional, Tuple

__all__ = ["offline_data_findings", "is_analysis_indeterminate"]


# --------------------------------------------------------------------------
# Flattening (same traversal as the Gemini data-analysis prompt builders)
# --------------------------------------------------------------------------

def _flatten(d: Any, parent_key: str = "", sep: str = " > ") -> Dict[str, str]:
    items: Dict[str, str] = {}
    if isinstance(d, dict):
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else str(k)
            if isinstance(v, dict):
                items.update(_flatten(v, new_key, sep))
            elif isinstance(v, list):
                for i, item in enumerate(v):
                    if isinstance(item, (dict, list)):
                        items.update(_flatten(item, f"{new_key}[{i}]", sep))
                    elif item is not None:
                        items[f"{new_key}[{i}]"] = str(item)
            elif v is not None:
                items[new_key] = str(v)
    elif isinstance(d, list):
        for i, item in enumerate(d):
            if isinstance(item, (dict, list)):
                items.update(_flatten(item, f"{parent_key}[{i}]", sep))
            elif item is not None:
                items[f"{parent_key}[{i}]"] = str(item)
    elif d is not None:
        items[parent_key] = str(d)
    return items


# --------------------------------------------------------------------------
# Regex evidence patterns
# --------------------------------------------------------------------------

_MONEY_RE = re.compile(
    r"(?:rs\.?|₹|inr)\s*[\d,]+(?:\.\d{1,2})?"
    r"|[\d,]+(?:\.\d{1,2})?\s*(?:rs\.?|₹|inr)",
    re.IGNORECASE,
)
_BARE_PRICE_RE = re.compile(r"^\s*[\d,]+(?:\.\d{1,2})?\s*$")
_UNIT_RE = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:g|gram|grams|gm|gms|kg|kgs|ml|millilit(?:er|re)s?|"
    r"l|litre|liter|litres|pcs|pieces|count|packs?|units?)\b",
    re.IGNORECASE,
)
_DIMENSIONS_RE = re.compile(
    r"\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?"
    r"(?:\s*(?:x|×)\s*\d+(?:\.\d+)?)?",
    re.IGNORECASE,
)
_PHONE_RE = re.compile(
    r"(?:\+91[\s\-]?)?\b[6-9]\d{9}\b"
    r"|\b\d{3,4}[\s\-]\d{6,8}\b"
)
_EMAIL_RE = re.compile(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}", re.IGNORECASE)
_PINCODE_RE = re.compile(r"\b[1-9]\d{5}\b")
_FSSAI_RE = re.compile(r"\b2\d{13}\b|\b\d{14}\b")
_MADE_IN_RE = re.compile(r"\bmade\s+in\s+([a-z][a-z\s]{2,30})", re.IGNORECASE)
_DATE_KEY_RE = re.compile(
    r"(?:^|[^\w])(?:best\s*before|use\s*by|expiry|exp(?:iry)?\s*date|"
    r"date\s*of\s*expiry|shelf\s*life|mfg\.?\s*date|manufactur\w*\s*date|"
    r"date\s*of\s*manufactur\w*)(?=$|[^\w])",
    re.IGNORECASE,
)
# Keys that must never be treated as compliance evidence.
_JUNK_KEY_RE = re.compile(
    r"(?:^|[\s>\[])(?:url|asin|image[s]?|image_urls|img|store_url|link"
    r"|product_id|id|node|ie=|dib|qid|sr|ref)(?:$|[\s>\]])",
    re.IGNORECASE,
)
# 'country' at the END of a flatten path is the *marketplace* country
# (e.g. amazon.in -> 'IN'), NOT a country-of-origin declaration.
_MARKET_COUNTRY_KEY_RE = re.compile(r"(?:^|\s>)country$", re.IGNORECASE)


_STATUS_RANK = {"present": 3, "partial": 2, "missing": 1}


# --------------------------------------------------------------------------
# Per-concept evidence scanning
# --------------------------------------------------------------------------

def _scan_concepts(pairs: List[Tuple[str, str]]) -> Dict[str, Dict[str, Any]]:
    """Scan flattened (key, value) pairs and keep the best evidence per
    concept. Returns {concept: {"status", "extracted_value", "found_in"}}.
    Only concepts with real evidence are returned; 'missing' findings for
    the remaining mapped rules are emitted by offline_data_findings()."""
    found: Dict[str, Dict[str, Any]] = {}

    def add(concept: str, status: str, value: str, key: str) -> None:
        value = (value or "").strip()
        if not value:
            return
        cur = found.get(concept)
        if cur is None or _STATUS_RANK.get(status, 0) > _STATUS_RANK.get(cur.get("status", ""), 0):
            found[concept] = {
                "status": status,
                "extracted_value": value[:300],
                "found_in": key[:200],
            }

    # Pre-scan for a currency so bare price numbers can be interpreted.
    currency = ""
    for key, val in pairs:
        if key.strip().lower() == "currency" and val.strip():
            currency = val.strip().upper()
            break

    for key, val in pairs:
        kl = key.lower()
        vl = val.lower()
        combined = f"{kl} {vl}"
        if _JUNK_KEY_RE.search(key) or not str(val).strip():
            continue

        # ---- MRP / price --------------------------------------------------
        if "price_per_unit" not in kl and "per unit" not in kl and "unit price" not in kl:
            if "mrp" in kl or "maximum retail price" in kl or "max retail price" in kl:
                if _MONEY_RE.search(val) or re.search(r"\d", val):
                    add("mrp", "present", val, key)
                else:
                    add("mrp", "partial", val, key)
            elif "price" in kl and "per" not in kl:
                if _MONEY_RE.search(val):
                    add("mrp", "present", val, key)
                elif _BARE_PRICE_RE.match(val) or re.match(r"^\s*(?:rs\.?|₹|inr)?\s*[\d,]+", val, re.I):
                    add("mrp", "present", f"{val.strip()} {currency}".strip(), key)
        if "mrp" in combined and "mrp" not in kl:
            if _MONEY_RE.search(val):
                add("mrp", "partial", val, key)

        # ---- Country of origin ---------------------------------------------
        if ("origin" in kl or "made in" in kl or "manufactured in" in kl) \
                and not _MARKET_COUNTRY_KEY_RE.search(key):
            add("origin", "present", val, key)
        m = _MADE_IN_RE.search(val)
        if m and "origin" not in found:
            add("origin", "present", m.group(0), key)

        # ---- Manufacturer / packer / importer -------------------------------
        if re.search(r"manufacturer|packed\s*by|packer|importer|marketed\s*by|mfd", kl):
            has_address = bool(_PINCODE_RE.search(val)) or ("," in val and len(val) > 25)
            add("manufacturer", "present" if has_address else "partial", val, key)

        # ---- Consumer care / contact ---------------------------------------
        if re.search(r"customer\s*care|consumer\s*care|helpline|contact|support", kl) \
                or _EMAIL_RE.search(val):
            add("contact", "present", val, key)
        if _PHONE_RE.search(val) and len(val) < 120:
            add("contact", "present", val, key)

        # ---- Net quantity --------------------------------------------------
        if re.search(r"net\s*quantity|net\s*wt|net\s*weight", kl):
            add("quantity", "present", val, key)
        elif re.search(r"weight|volume|item\s*weight|package\s*weight", kl):
            if _UNIT_RE.search(val):
                add("quantity", "present", val, key)

        # ---- Unit price -----------------------------------------------------
        if "price_per_unit" in kl or "unit price" in kl or "price per" in kl:
            add("unit_price", "present", val, key)
        if re.search(r"per\s*(?:100\s*)?(?:g|gram|kg|ml|l)\b|/\s*(?:g|ml|kg)\b", vl) \
                and re.search(r"\d", val):
            add("unit_price", "present", val, key)

        # ---- Manufacturing / expiry dates -----------------------------------
        if _DATE_KEY_RE.search(kl) and "date first available" not in kl:
            add("dates", "present", val, key)

        # ---- Dimensions / size ----------------------------------------------
        if "dimension" in kl:
            add("dimensions", "present", val, key)
        elif _DIMENSIONS_RE.search(val) and "dimension" not in kl:
            add("dimensions", "present", val, key)

        # ---- Common / generic name -------------------------------------------
        if kl == "title" or kl.endswith("title") or "product name" in kl \
                or "generic name" in kl or "commodity name" in kl:
            add("common_name", "present", val, key)

        # ---- Extra concepts used by the category rule sets -------------------
        if "fssai" in combined or _FSSAI_RE.search(val):
            add("fssai", "present", val, key)
        if re.search(r"\bvegetarian\b|\bveg\b", vl):
            add("veg", "present", val, key)
        if "ingredients" in kl:
            add("ingredients", "present", val, key)
        if "nutrition" in kl:
            add("nutrition", "present", val, key)

    # Compose a readable unit price from price_per_unit sub-fields when present.
    ppu: Dict[str, str] = {}
    for key, val in pairs:
        if "price_per_unit" in key.lower():
            leaf = key.lower().split(">")[-1].strip()
            ppu[leaf] = val.strip()
    if ppu:
        text = " ".join(
            x for x in (
                f"{ppu.get('value', '')}".strip(),
                ppu.get("currency", "").strip(),
                ("per " + ppu.get("unit", "").strip()) if ppu.get("unit") else "",
            ) if x
        )
        if text:
            found["unit_price"] = {
                "status": "present",
                "extracted_value": text[:300],
                "found_in": "price_per_unit",
            }

    return found


# --------------------------------------------------------------------------
# Rule -> concept mapping
# --------------------------------------------------------------------------

def _concept_for_rule(rule: Dict[str, Any]) -> Optional[str]:
    """Map a scorer rule (name + keywords) to a concept this module can
    extract offline. Order matters (specific before generic)."""
    text = (str(rule.get("name", "")) + " "
            + " ".join(str(k) for k in (rule.get("keywords") or []))).lower()
    if "fssai" in text:
        return "fssai"
    if "veg" in text and ("symbol" in text or "dot" in text):
        return "veg"
    if "ingredient" in text and "type" not in text:
        return "ingredients"
    if "nutrition" in text:
        return "nutrition"
    if "mrp" in text or "retail price" in text:
        return "mrp"
    if "origin" in text or "made in" in text or "manufactured in" in text:
        return "origin"
    if re.search(r"manufacturer|packer|importer|marketed by|mfd", text):
        return "manufacturer"
    if re.search(r"care|helpline|contact|complaint", text):
        return "contact"
    if "net" in text or "quantity" in text or "net wt" in text:
        return "quantity"
    if "unit price" in text or "unit sale" in text or "price per" in text \
            or "per gram" in text or "per ml" in text:
        return "unit_price"
    if re.search(r"expiry|best before|use by|shelf life|mfg date|manufactur\w* date|date of manufacture", text):
        return "dates"
    if "dimension" in text or "size" in text:
        return "dimensions"
    if re.search(r"common|generic name|product name|description", text):
        return "common_name"
    return None


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------

def offline_data_findings(
    product_data: Any,
    category: str = "amazon",
    rules: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Deterministic offline replacement for the Gemini data-analysis step.

    Returns the same shape the Gemini prompt asks for:
      {"findings": [ {requirement, status, found_in, extracted_value,
                      adequacy, notes} ... ],
       "data_quality_score": 0..1,
       "missing_critical_info": [...],
       "recommendations": [...],
       "offline": True, "analysis_mode": "offline"}

    Rules without a mapped concept are simply skipped (no finding emitted) —
    the scorer treats those exactly like a rule the data source said nothing
    about, and `is_analysis_indeterminate` keeps an AI outage from turning
    that into a fake 0/F.
    """
    flattened = _flatten(product_data) if product_data is not None else {}
    pairs = [(k, v) for k, v in flattened.items()
             if v is not None and str(v).strip()]
    evidence = _scan_concepts(pairs) if pairs else {}

    findings: List[Dict[str, Any]] = []
    if rules:
        for rule in rules:
            name = str(rule.get("name", "") or "")
            concept = _concept_for_rule(rule)
            if not name or concept is None:
                continue
            ev = evidence.get(concept)
            if ev:
                findings.append({
                    "requirement": name,
                    "status": ev["status"],
                    "found_in": ev["found_in"],
                    "extracted_value": ev["extracted_value"],
                    "adequacy": "adequate" if ev["status"] == "present" else "inadequate",
                    "notes": "extracted offline (deterministic keyword/regex match)",
                })
            else:
                findings.append({
                    "requirement": name,
                    "status": "missing",
                    "found_in": "",
                    "extracted_value": "",
                    "adequacy": "missing",
                    "notes": "not found in listing data by the offline extractor",
                })

    present = [f for f in findings if f["status"] == "present"]
    partial = [f for f in findings if f["status"] == "partial"]
    missing = [f for f in findings if f["status"] == "missing"]
    quality = (
        (len(present) + 0.5 * len(partial)) / len(findings)
        if findings else 0.0
    )

    recommendations: List[str] = []
    if missing:
        recommendations.append(
            "OFFLINE ANALYSIS: the AI data-analysis service was unavailable, "
            "so this result was extracted deterministically from the listing "
            "data only. Re-run the compliance analysis when the AI quota "
            "resets for full verification."
        )

    return {
        "findings": findings,
        "data_quality_score": round(quality, 2),
        "missing_critical_info": [f["requirement"] for f in missing],
        "recommendations": recommendations,
        "offline": True,
        "analysis_mode": "offline",
    }


def is_analysis_indeterminate(
    ocr_results: Optional[Dict[str, Any]],
    data_analysis: Optional[Dict[str, Any]],
) -> bool:
    """
    True when NO findings were produced by ANY source AND at least one
    analysis layer actually FAILED (AI error / rate-limit / offline marker).

    This is the signal that "we could not analyze" — which must be reported
    as grade 'N/A' — as opposed to "we analyzed everything and nothing is
    declared", which legitimately scores 0/F (audit case #4).
    """
    ocr = ocr_results or {}
    data = data_analysis or {}
    ocr_has = len(ocr.get("visual_findings") or []) > 0
    data_has = len(data.get("findings") or []) > 0
    if ocr_has or data_has:
        return False
    ocr_failed = bool(ocr.get("error")) or ocr.get("ocr_success") is False
    data_failed = bool(data.get("error")) or bool(data.get("offline"))
    return bool(ocr_failed or data_failed)

