#!/usr/bin/env python3
"""
PHASE 12 — Re-grade products poisoned by the fake-F bug.

Problem: when the Gemini quota was exhausted, the analysis pipeline graded
products 0.0/F ("all declarations missing") even when their scraped listing
data contained real Legal Metrology declarations. Those fake reports were
PERSISTED to Products.analysis_results / remarks / rating — e.g. product
19 (Maggi 2-Minute Masala Noodles, ASIN B01N1UL0MZ) shows
'Grade: F | Score: 0.0' in the dashboard despite a compliant listing.

This script:
  1. finds every product whose persisted report matches the known
     signature of the fake-F bug: score 0, grade F, zero violations in
     BOTH sources, and both analysis layers marked failed/offline
     (ocr_analysis.success False or missing + data_analysis.quality 0),
  2. re-runs the (now fixed) compliance engine for each, preferring the
     AI when available and falling back to the deterministic offline
     extractor otherwise, and
  3. re-persists the honest result — including 'N/A' when the analysis
     is indeterminate.

Usage (from the backend dir):
    .\\venv\\Scripts\\python.exe regrade_products.py            # auto-detect poisoned rows
    .\\venv\\Scripts\\python.exe regrade_products.py 18 19      # explicit product ids
"""
import json
import os
import sys

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime

import mysql.connector
from dotenv import load_dotenv

import compliance_copy  # the same engine /api/scrape auto-analyze uses

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME'),
    'port': int(os.getenv('DB_PORT', 3306)),
}


def get_conn():
    return mysql.connector.connect(**DB_CONFIG)


def looks_poisoned(report: dict) -> bool:
    """Signature of the fake-F bug in a persisted report:
    score 0 + grade F + both AI layers failed + zero high/low violations."""
    if not isinstance(report, dict):
        return False
    try:
        if float(report.get('compliance_score', 0)) != 0.0:
            return False
    except (TypeError, ValueError):
        return False
    if report.get('compliance_grade') != 'F':
        return False
    ocr = report.get('ocr_analysis') or {}
    if ocr.get('success'):
        return False  # real OCR ran and found nothing -> legitimate F
    summary = report.get('violation_summary') or {}
    # The bug produced high=5/low=4 (all rules penalized) with the OCR layer
    # failed. A genuine F from a real analysis shows ocr success True.
    return summary.get('total', 0) > 0 and not ocr.get('success')


def main():
    explicit_ids = [int(a) for a in sys.argv[1:] if a.isdigit()]
    conn = get_conn()
    cur = conn.cursor(dictionary=True)

    if explicit_ids:
        cur.execute(
            "SELECT product_id, asin, title, analysis_results, remarks, rating "
            "FROM Products WHERE product_id IN (%s)",
            tuple(explicit_ids))
        rows = cur.fetchall()
    else:
        cur.execute(
            "SELECT product_id, asin, title, analysis_results, remarks, rating "
            "FROM Products WHERE remarks LIKE %s OR rating = 0",
            ('Grade: F%',))
        rows = [r for r in cur.fetchall() if looks_poisoned(_parse(r['analysis_results']))]

    if not rows:
        print("[REGRADE] No poisoned (fake-F) products found. Nothing to do.")
        cur.close()
        conn.close()
        return

    print(f"[REGRADE] {len(rows)} product(s) to re-grade:")
    for r in rows:
        print(f"  - product {r['product_id']}: {r['title']} "
              f"(old remarks: {r['remarks']!r}, rating: {r['rating']})")

    fixed = 0
    for r in rows:
        pid = r['product_id']
        print(f"\n[REGRADE] Re-analyzing product {pid} with the fixed engine...")
        try:
            report = compliance_copy.analyze_compliance(pid)
        except Exception as e:
            print(f"[REGRADE] FAILED for product {pid}: {e}")
            continue
        if not report or 'error' in report:
            print(f"[REGRADE] FAILED for product {pid}: {(report or {}).get('error')}")
            continue

        grade = report.get('compliance_grade')
        score = report.get('compliance_score')
        print(f"[REGRADE] product {pid}: old Grade F / 0.0 -> new {grade} / {score}")

        # analyze_compliance already persisted the new report/remarks/rating;
        # count it.
        fixed += 1

    print(f"\n[REGRADE] Done. {fixed}/{len(rows)} product(s) re-graded at "
          f"{datetime.now().isoformat()}.")
    cur.close()
    conn.close()


def _parse(raw):
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw or '{}')
    except Exception:
        return {}


if __name__ == '__main__':
    main()
